// @ts-nocheck
/**
 * Random seed utilities for deterministic random number generation
 * 
 * Provides utilities for:
 * - Creating random seeds
 * - Hashing random seeds
 * - Getting random values (increments seed index automatically)
 * - Getting random values in a bounded range (uniform distribution)
 */

// Random seed structure
export class RandomSeed {
  baseSeed: string;
  index: i32;

  constructor(baseSeed: string, index: i32 = 0) {
    this.baseSeed = baseSeed;
    this.index = index;
  }

  // Create a copy with incremented index
  increment(): RandomSeed {
    return new RandomSeed(this.baseSeed, this.index + 1);
  }

  // Create a copy with a specific index
  withIndex(index: i32): RandomSeed {
    return new RandomSeed(this.baseSeed, index);
  }
}

/**
 * Create a new random seed from a base seed string
 * @param baseSeed The base seed string
 * @returns A new RandomSeed with index 0
 */
export function createRandomSeed(baseSeed: string): RandomSeed {
  return new RandomSeed(baseSeed, 0);
}

/**
 * 32-bit mixing function (MurmurHash3 finalizer style)
 * Provides excellent avalanche properties - small input changes cause large output changes
 * @param x The input value to mix
 * @returns Well-mixed 32-bit value
 */
function mix32(x: u32): u32 {
  x ^= x >> 16;
  x *= 0x85ebca6b;
  x ^= x >> 13;
  x *= 0xc2b2ae35;
  x ^= x >> 16;
  return x;
}

/**
 * Hash a random seed (base seed + index) to get a deterministic hash value
 * Uses MurmurHash3-style mixing for excellent avalanche properties
 * @param seed The random seed to hash
 * @returns A 32-bit hash value
 */
export function hashRandomSeed(seed: RandomSeed): i32 {
  // Hash the base seed string using FNV-1a algorithm (better distribution than djb2)
  let h: u32 = 2166136261; // FNV offset basis
  const baseLen = seed.baseSeed.length;
  for (let i = 0; i < baseLen; i++) {
    const char = <u32>seed.baseSeed.charCodeAt(i);
    h ^= char;
    h *= 16777619; // FNV prime
  }
  
  // Combine with index using XOR and multiplication (not addition!)
  // XOR ensures the index bits actually mix with the hash bits
  const indexBits = mix32(<u32>seed.index);
  h ^= indexBits;
  
  // Final mixing pass to ensure all bits are well-distributed
  // This breaks any linear correlation between consecutive indices
  h = mix32(h);
  
  return <i32>h;
}

/**
 * Result object containing a random value and the updated seed
 */
export class RandomResult {
  value: f64;
  seed: RandomSeed;

  constructor(value: f64, seed: RandomSeed) {
    this.value = value;
    this.seed = seed;
  }
}

/**
 * Get a random value in the range [0, 1) from a base seed and index
 * Automatically increments the seed index
 * @param baseSeed The base seed string
 * @param index The current seed index
 * @returns A RandomResult containing the random value and the updated seed with incremented index
 */
export function getRandomValueFromSeed(baseSeed: string, index: i32): RandomResult {
  const seed = new RandomSeed(baseSeed, index);
  return getRandomValue(seed);
}

/**
 * Deterministic PRNG using SplitMix32-style algorithm
 * Provides excellent statistical properties with fast computation
 * This works reliably in both test and production environments
 */
function deterministicRandom(hash: i32): f64 {
  // SplitMix32-style algorithm for high-quality random numbers
  // The hash already went through mix32, but we apply one more transformation
  // to ensure the output is well-distributed
  
  let state: u32 = <u32>hash;
  
  // SplitMix32 step: add golden ratio constant, then mix
  state += 0x9e3779b9; // Golden ratio * 2^32
  
  // Final mixing using the same high-quality mixer
  state = mix32(state);
  
  // Convert to [0, 1) range
  // Divide by 2^32 to get value in [0, 1)
  return <f64>state / 4294967296.0;
}

/**
 * Get a random value in the range [0, 1) from a random seed
 * Automatically increments the seed index
 * 
 * Determinism is ensured by:
 * 1. Hashing the baseSeed + index together (each index produces a different hash)
 * 2. Using the hash with a deterministic PRNG (works in both test and production)
 * 3. Incrementing the index for the next call (ensures next call uses different hash)
 * 
 * @param seed The random seed (includes baseSeed and current index)
 * @returns A RandomResult containing the random value and the updated seed with incremented index
 */
export function getRandomValue(seed: RandomSeed): RandomResult {
  // Hash includes both baseSeed AND index - this ensures each index produces a different hash
  // Example: baseSeed="test", index=0 -> hash("test:0")
  //          baseSeed="test", index=1 -> hash("test:1") (different hash!)
  const hash = hashRandomSeed(seed);
  
  // Use deterministic PRNG based on hash (works in both test and production)
  // This is more reliable than NativeMath.random() which may not work in test environments
  const randomValue = deterministicRandom(hash);
  
  // CRITICAL: Increment the seed index for next call
  // This ensures the next call will use a different hash (baseSeed + (index+1))
  // which will produce a different deterministic random value
  const newSeed = seed.increment();
  
  return new RandomResult(randomValue, newSeed);
}

/**
 * Get a random value in the range [min, max) from a base seed and index
 * Uses uniform distribution: value = min + random * (max - min)
 * Automatically increments the seed index
 * @param baseSeed The base seed string
 * @param index The current seed index
 * @param min Minimum value (inclusive)
 * @param max Maximum value (exclusive)
 * @returns A RandomResult containing the random value in [min, max) and the updated seed
 */
export function getRandomInRangeFromSeed(baseSeed: string, index: i32, min: f64, max: f64): RandomResult {
  const seed = new RandomSeed(baseSeed, index);
  return getRandomInRange(seed, min, max);
}

/**
 * Get a random value in the range [min, max) from a random seed
 * Uses uniform distribution: value = min + random * (max - min)
 * Automatically increments the seed index
 * @param seed The random seed
 * @param min Minimum value (inclusive)
 * @param max Maximum value (exclusive)
 * @returns A RandomResult containing the random value in [min, max) and the updated seed
 */
export function getRandomInRange(seed: RandomSeed, min: f64, max: f64): RandomResult {
  const result = getRandomValue(seed);
  const value = min + result.value * (max - min);
  return new RandomResult(value, result.seed);
}

/**
 * Get a random integer in the range [min, max) from a base seed and index
 * Uses uniform distribution
 * Automatically increments the seed index
 * @param baseSeed The base seed string
 * @param index The current seed index
 * @param min Minimum value (inclusive)
 * @param max Maximum value (exclusive)
 * @returns A RandomResult containing a random integer in [min, max) and the updated seed
 */
export function getRandomIntInRangeFromSeed(baseSeed: string, index: i32, min: i32, max: i32): RandomResult {
  const seed = new RandomSeed(baseSeed, index);
  return getRandomIntInRange(seed, min, max);
}

/**
 * Get a random integer in the range [min, max) from a random seed
 * Uses uniform distribution
 * Automatically increments the seed index
 * @param seed The random seed
 * @param min Minimum value (inclusive)
 * @param max Maximum value (exclusive)
 * @returns A RandomResult containing a random integer in [min, max) and the updated seed
 */
export function getRandomIntInRange(seed: RandomSeed, min: i32, max: i32): RandomResult {
  const result = getRandomValue(seed);
  const range = <f64>(max - min);
  const intValue = min + <i32>Math.floor(result.value * range);
  return new RandomResult(<f64>intValue, result.seed);
}

