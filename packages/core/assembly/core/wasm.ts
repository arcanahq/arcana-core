// @ts-nocheck
/**
 * WASM interface helpers for memory management and encoding
 * 
 * CRITICAL: Scratch allocator pointer lifetime
 * =============================================
 * All pointers returned by scratch_alloc() are ONLY valid until the next call to scratch_reset().
 * The host MUST copy any needed data before calling scratch_reset() or the next handle() invocation.
 * 
 * Usage pattern:
 * 1. Host calls scratch_alloc() to write input strings
 * 2. Host calls handle() which immediately calls scratch_reset() (invalidating input pointers)
 * 3. handle() reads input strings BEFORE calling scratch_reset()
 * 4. handle() uses scratch_alloc() for output, returns pointer to host
 * 5. Host copies output data, then scratch_reset() is called on next invocation
 */


// Memory management - AssemblyScript provides these
declare const __heap_base: usize;

// Scratch allocator for ephemeral input/output buffers
// Uses a managed Uint8Array to ensure GC doesn't reuse the memory
let scratch: Uint8Array = new Uint8Array(0);
let scratch_head: i32 = 0;

// Telemetry for debugging memory growth
export let lastGrowPages: i32 = 0;
export let lastGrowResult: i32 = 0;
export function memPages(): i32 { return memory.size(); }
export function current_pages(): i32 { return memory.size(); }

// Enhanced telemetry for debugging allocation failures
export let scratch_base: i32 = 0;
export let scratch_ptr: i32 = 0;
export let lastAllocReq: i32 = 0;
export let lastAllocAligned: i32 = 0;
export let lastAllocPtr: i32 = 0;
export let lastAllocNext: i32 = 0;
export let allocFailReason: i32 = 0; // 0=success, 1=neg/zero, 2=overflow, 3=oom (after growth attempt)

const PAGE: usize = 65536;

function nextPow2(x: i32): i32 {
  let v = 1;
  while (v < x) v <<= 1;
  return v;
}

function ensure_scratch_init(): void {
  // Initialize with a small default size if not already initialized
  if (scratch.length == 0) {
    scratch = new Uint8Array(64 * 1024); // 64KB default
    scratch_head = 0;
    scratch_base = scratch.dataStart as i32;
    scratch_ptr = scratch.dataStart as i32;
  }
}

/**
 * Reset scratch allocator (reset head pointer, keep buffer)
 * 
 * WARNING: This invalidates ALL previously returned scratch pointers.
 * Host must copy any needed data before this is called.
 */
export function scratch_reset(): void {
  ensure_scratch_init();
  scratch_head = 0;
  scratch_base = scratch.dataStart as i32;
  scratch_ptr = scratch.dataStart as i32;
}

export function init_scratch_base(base: i32): void {
  // Legacy function - no longer needed with managed Uint8Array approach
  // Keep for compatibility but do nothing
  ensure_scratch_init();
}

/**
 * Ensure scratch buffer has at least `total` bytes capacity
 * Call this BEFORE allocating any scratch space
 */
export function ensureScratchCapacity(total: i32): void {
  ensure_scratch_init();
  if (scratch.length >= total) return;
  let cap = nextPow2(total);
  scratch = new Uint8Array(cap); // Allocated from heap, "owned" by runtime
  scratch_head = 0;
  scratch_base = scratch.dataStart as i32;
  scratch_ptr = scratch.dataStart as i32;
}

export function scratch_alloc(size: i32): i32 {
  ensure_scratch_init();
  
  lastAllocReq = size;
  allocFailReason = 0;

  if (size <= 0) {
    allocFailReason = 1;
    return 0;
  }

  const MAX_SINGLE_ALLOC: i32 = 16 * 1024 * 1024;
  if (size > MAX_SINGLE_ALLOC) {
    allocFailReason = 2;
    return 0;
  }

  // Align size to 8 bytes for better performance
  let alignedSize = (size + 7) & ~7;
  
  // Check if we have enough space in current buffer
  if (scratch_head + alignedSize > scratch.length) {
    // Need to grow - allocate new buffer with enough space
    let needed = scratch_head + alignedSize;
    let cap = nextPow2(needed);
    scratch = new Uint8Array(cap);
    scratch_head = 0; // Reset head when reallocating
  }

  // Allocate from scratch buffer (growing forward from head)
  let ptr = scratch.dataStart + scratch_head;
  scratch_head += alignedSize;
  lastAllocPtr = ptr as i32;
  lastAllocNext = (scratch.dataStart + scratch_head) as i32;
  scratch_ptr = ptr as i32;
  return ptr as i32;
}

// Export aliases for Rust compatibility
export function alloc(size: i32): i32 {
  return scratch_alloc(size);
}

export function reset_alloc(): void {
  scratch_reset();
}

// Export free function for Rust to use (optional, for cleanup)
// Scratch allocations are raw pointers, so no GC interaction is required.
export function free(_ptr: i32): void {}

/**
 * Read a UTF-8 string from WASM memory
 * 
 * @param ptr - Memory pointer (must be valid)
 * @param len - Exact number of bytes to read
 * @returns Decoded string (empty if ptr is 0 or len <= 0)
 */
export function readString(ptr: i32, len: i32): string {
  // Handle zero/null pointer or zero length safely
  if (ptr == 0 || len <= 0) {
    return "";
  }
  
  // Validate that we're not reading past memory bounds
  // This prevents reading stale data from previous allocations
  const memSize = memory.size() as usize;
  const maxAddr = memSize * PAGE;
  const readEnd = (ptr as usize) + (len as usize);
  
  if (readEnd > maxAddr) {
    // Clamp to memory size to prevent out-of-bounds read
    const clampedLen = (maxAddr - (ptr as usize)) as i32;
    if (clampedLen <= 0) {
      return "";
    }
    return String.UTF8.decodeUnsafe(ptr as usize, clampedLen, false);
  }
  
  // Use nullTerminated=false since Rust writes exact length without null terminator
  // The host writes exactly `len` bytes, so we decode exactly `len` bytes
  return String.UTF8.decodeUnsafe(ptr as usize, len, false);
}

/**
 * Read raw bytes from WASM memory.
 *
 * Returns a copy owned by the caller.
 */
export function readBytes(ptr: i32, len: i32): Uint8Array {
  if (ptr == 0 || len <= 0) {
    return new Uint8Array(0);
  }

  const memSize = memory.size() as usize;
  const maxAddr = memSize * PAGE;
  const readEnd = (ptr as usize) + (len as usize);
  const safeLen = readEnd > maxAddr ? (maxAddr - (ptr as usize)) as i32 : len;
  if (safeLen <= 0) {
    return new Uint8Array(0);
  }

  const out = new Uint8Array(safeLen);
  memory.copy(out.dataStart, ptr as usize, safeLen as usize);
  return out;
}

// Helper to pack (ptr, len) into i64 for return value
// High 32 bits = len, low 32 bits = ptr
export function packPtrLen(ptr: i32, len: i32): i64 {
  return (<i64>len << 32) | (<i64>ptr & 0xffffffff);
}

// PROBE: Check if __heap_base is valid
export function __probe_heap_base(): i64 {
  // pack two u32s: low = heap_base, high = memory.size()
  const hb = __heap_base as u32;
  const ms = memory.size() as u32;
  return (i64(ms) << 32) | i64(hb);
}

// PROBE: Return constant without touching memory
export function __probe_const(): i64 {
  return 0x1122334455667788;
}
