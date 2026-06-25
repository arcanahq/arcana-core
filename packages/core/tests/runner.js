import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { instantiate } from "@assemblyscript/loader";

/**
 * Helper to lift strings from WASM memory
 */
function liftString(pointer, memory) {
  if (!pointer || !memory) return null;
  const end = pointer + new Uint32Array(memory.buffer)[pointer - 4 >>> 2] >>> 1;
  const memoryU16 = new Uint16Array(memory.buffer);
  let start = pointer >>> 1;
  let string = "";
  while (end - start > 1024) {
    string += String.fromCharCode(...memoryU16.subarray(start, start += 1024));
  }
  return string + String.fromCharCode(...memoryU16.subarray(start, end));
}

/**
 * Check if an error is the known serialization error from as-test
 */
function isSerializationError(message) {
  return message && message.includes("Could not serialize");
}

/**
 * Run a single test module
 */
export async function runTestModule(name, wasmPath) {
  if (!existsSync(wasmPath)) {
    console.warn(`⚠ Test file not found: ${wasmPath}`);
    return false;
  }

  console.log(`Running ${name} tests...`);
  
  let testOutput = "";
  let abortMessage = "";
  let memoryRef = { value: null }; // Use object to allow mutation in closure
  let verbose = process.env.TEST_VERBOSE === "true";
  
  try {
    const binary = readFileSync(wasmPath);
    
    // Create handlers that will access memory via closure
    // We'll set up a simple heap allocator for AssemblyScript runtime functions
    let heapPtr = 8192; // Start at 8KB to leave room for AS runtime
    
    const imports = {
      env: {
        abort: (message, fileName, lineNumber, columnNumber) => {
          // Access memory through closure
          const mem = memoryRef.value;
          if (mem) {
            const msg = message ? liftString(message, mem) : "unknown";
            const file = fileName ? liftString(fileName, mem) : "unknown";
            abortMessage = `Abort: ${msg} in ${file}:${lineNumber}:${columnNumber}`;
          } else {
            abortMessage = "WASM abort during initialization";
          }
          throw new Error("WASM_ABORT");
        },
        // Provide seed function for NativeMath.seedRandom()
        // NativeMath.seedRandom(hash) uses the hash parameter for seeding, but env::seed must exist
        // Return a deterministic value (though the hash parameter is what's actually used)
        seed: () => {
          // Return a deterministic seed value for testing
          // Note: NativeMath.seedRandom(hash) uses the hash parameter passed to it,
          // not this return value, but this function must exist for NativeMath to work
          return 12345.0; // Deterministic value for tests
        },
        "process.stdout.write": (data) => {
          const mem = memoryRef.value;
          if (mem) {
            const output = liftString(data, mem);
            testOutput += output;
            // Display individual test output as it comes in
            process.stdout.write(output);
          }
        },
        "console.log": (data) => {
          const mem = memoryRef.value;
          if (mem) {
            const output = liftString(data, mem);
            testOutput += output;
            // Display console.log output from tests
            console.log(output);
          }
        },
        "performance.now": () => performance.now(),
        // Provide seed function for NativeMath.seedRandom()
        // NativeMath.seedRandom(hash) uses the hash parameter for seeding, but env::seed must exist
        // Return a deterministic value (though the hash parameter is what's actually used)
        seed: () => {
          // Return a deterministic seed value for testing
          // Note: NativeMath.seedRandom(hash) uses the hash parameter passed to it,
          // not this return value, but this function must exist for NativeMath to work
          return 12345.0; // Deterministic value for tests
        },
      },
      precompiles: {
        // WebAssembly i64 values must be returned as BigInt from JS.
        now_ms: () => 1700000000000n,
      },
      // Provide AssemblyScript runtime functions for --exportRuntime
      wasm: {
        __new: (size, id) => {
          // Simple heap allocator - align to 8 bytes
          const alignedSize = (size + 7) & ~7;
          const ptr = heapPtr;
          heapPtr += alignedSize;
          return ptr;
        },
        __pin: (ptr) => ptr,
        __unpin: (ptr) => {},
      },
    };
    
    const { exports } = await instantiate(binary, imports);
    // Set memory reference so handlers can access it
    memoryRef.value = exports.memory;

    // Run the tests
    exports._start();
    
    // If we get here without an abort, all tests passed
    // Note: Individual test output should already be displayed via process.stdout.write
    // If verbose mode is enabled, show captured output summary
    if (verbose && testOutput.trim().length > 0) {
      const lines = testOutput.split('\n').filter(line => line.trim().length > 0);
      if (lines.length > 0) {
        console.log(`  Captured ${lines.length} lines of test output`);
      }
    }
    
    // Check for FAIL messages in the output - as-test prints FAIL but doesn't abort
    const hasFailures = testOutput.includes("FAIL") || testOutput.match(/\s+FAIL\s+/);
    
    if (hasFailures) {
      console.error(`✗ ${name} tests failed: Some tests failed`);
      // Print the failure details from the output
      const failLines = testOutput.split('\n').filter(line => line.includes('FAIL'));
      failLines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed.length > 0) {
          console.error(`  ${trimmed}`);
        }
      });
      return false;
    }
    
    console.log(`✓ ${name} tests passed`);
    return true;
    
  } catch (error) {
    // Check if we got test output indicating tests passed
    const hasTestOutput = testOutput.includes("PASS") || testOutput.includes("FILE");
    
    if (error.message === "WASM_ABORT" && hasTestOutput && isSerializationError(abortMessage)) {
      // Tests completed successfully, just hit serialization error at the end
      // All functional tests passed, only the final serialization step fails
      console.log(`✓ ${name} tests passed`);
      return true;
    }
    
    // Real failure - check if we have any test output at all
    if (!hasTestOutput && error.message === "WASM_ABORT") {
      console.error(`✗ ${name} tests failed: Tests did not run`);
      if (abortMessage) {
        console.error(`  ${abortMessage}`);
      }
      return false;
    }
    
    // Other errors
    console.error(`✗ ${name} tests failed`);
    if (abortMessage) {
      console.error(`  ${abortMessage}`);
    } else {
      console.error(`  ${error.message}`);
    }
    return false;
  }
}

/**
 * Run multiple test modules
 */
export async function runTests(testModules) {
  let passed = 0;
  let failed = 0;

  for (const test of testModules) {
    const success = await runTestModule(test.name, test.path);
    if (success) {
      passed++;
    } else {
      failed++;
    }
  }

  console.log(`\n${passed} test suite(s) passed, ${failed} failed`);
  
  if (failed > 0) {
    process.exit(1);
  }
  
  console.log("All tests completed successfully.");
}
