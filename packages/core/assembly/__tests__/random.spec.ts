// @ts-nocheck
/**
 * Tests for random seed utilities
 */

import { describe, test, expect } from "assemblyscript-unittest-framework/assembly";
import {
  RandomSeed,
  createRandomSeed,
  hashRandomSeed,
  getRandomValue,
  getRandomInRange,
  getRandomIntInRange
} from "../primitives/random";

describe("RandomSeed", () => {
  test("should create RandomSeed with base seed and index", () => {
    const seed = new RandomSeed("test-seed", 5);
    
    expect(seed.baseSeed).equal("test-seed");
    expect(seed.index).equal(5);
  });

  test("should default index to 0", () => {
    const seed = new RandomSeed("test-seed");
    
    expect(seed.baseSeed).equal("test-seed");
    expect(seed.index).equal(0);
  });

  test("increment should create new seed with incremented index", () => {
    const seed = new RandomSeed("test", 10);
    const incremented = seed.increment();
    
    expect(incremented.baseSeed).equal("test");
    expect(incremented.index).equal(11);
    expect(seed.index).equal(10); // Original unchanged
  });

  test("withIndex should create new seed with specific index", () => {
    const seed = new RandomSeed("test", 5);
    const newSeed = seed.withIndex(20);
    
    expect(newSeed.baseSeed).equal("test");
    expect(newSeed.index).equal(20);
    expect(seed.index).equal(5); // Original unchanged
  });
});

describe("createRandomSeed", () => {
  test("should create RandomSeed with index 0", () => {
    const seed = createRandomSeed("my-seed");
    
    expect(seed.baseSeed).equal("my-seed");
    expect(seed.index).equal(0);
  });
});

describe("hashRandomSeed", () => {
  test("should produce deterministic hash for same seed and index", () => {
    const seed1 = new RandomSeed("test", 0);
    const seed2 = new RandomSeed("test", 0);
    
    const hash1 = hashRandomSeed(seed1);
    const hash2 = hashRandomSeed(seed2);
    
    expect(hash1).equal(hash2);
  });

  test("should produce different hash for different seeds", () => {
    const seed1 = new RandomSeed("seed1", 0);
    const seed2 = new RandomSeed("seed2", 0);
    
    const hash1 = hashRandomSeed(seed1);
    const hash2 = hashRandomSeed(seed2);
    
    // Explicitly check they are not equal
    // If this fails, the hash function has a bug
    expect(hash1 === hash2).equal(false);
  });

  test("should produce different hash for different indices", () => {
    const seed1 = new RandomSeed("test", 0);
    const seed2 = new RandomSeed("test", 1);
    
    const hash1 = hashRandomSeed(seed1);
    const hash2 = hashRandomSeed(seed2);
    
    // Explicitly check they are not equal
    expect(hash1 === hash2).equal(false);
  });

  test("should produce consistent hash values", () => {
    const seed = new RandomSeed("consistent-test", 42);
    
    const hash1 = hashRandomSeed(seed);
    const hash2 = hashRandomSeed(seed);
    
    expect(hash1).equal(hash2);
  });
});

describe("getRandomValue", () => {
  test("should return value in range [0, 1)", () => {
    const seed = createRandomSeed("test");
    const result = getRandomValue(seed);
    
    expect(result.value >= 0.0).equal(true);
    expect(result.value < 1.0).equal(true);
  });

  test("should increment seed index", () => {
    const seed = createRandomSeed("test");
    const result = getRandomValue(seed);
    
    expect(result.seed.index).equal(1);
    expect(result.seed.baseSeed).equal("test");
  });

  test("should produce deterministic values for same seed", () => {
    const seed1 = createRandomSeed("deterministic");
    const seed2 = createRandomSeed("deterministic");
    
    const result1 = getRandomValue(seed1);
    const result2 = getRandomValue(seed2);
    
    expect(result1.value).equal(result2.value);
  });

  test("should produce different values on subsequent calls", () => {
    const seed = createRandomSeed("test");
    
    const result1 = getRandomValue(seed);
    const result2 = getRandomValue(result1.seed);
    
    expect(result1.value).not.equal(result2.value);
  });

  test("should produce same sequence for same base seed", () => {
    const seed1 = createRandomSeed("sequence-test");
    const seed2 = createRandomSeed("sequence-test");
    
    const r1_1 = getRandomValue(seed1);
    const r2_1 = getRandomValue(seed2);
    expect(r1_1.value).equal(r2_1.value);
    
    const r1_2 = getRandomValue(r1_1.seed);
    const r2_2 = getRandomValue(r2_1.seed);
    expect(r1_2.value).equal(r2_2.value);
  });
});

describe("getRandomInRange", () => {
  test("should return value in specified range", () => {
    const seed = createRandomSeed("range-test");
    const result = getRandomInRange(seed, 10.0, 20.0);
    
    expect(result.value >= 10.0).equal(true);
    expect(result.value < 20.0).equal(true);
  });

  test("should handle negative ranges", () => {
    const seed = createRandomSeed("negative-test");
    const result = getRandomInRange(seed, -5.0, 5.0);
    
    expect(result.value >= -5.0).equal(true);
    expect(result.value < 5.0).equal(true);
  });

  test("should increment seed index", () => {
    const seed = createRandomSeed("test");
    const result = getRandomInRange(seed, 0.0, 10.0);
    
    expect(result.seed.index).equal(1);
  });

  test("should produce deterministic values for same seed", () => {
    const seed1 = createRandomSeed("deterministic-range");
    const seed2 = createRandomSeed("deterministic-range");
    
    const result1 = getRandomInRange(seed1, 5.0, 15.0);
    const result2 = getRandomInRange(seed2, 5.0, 15.0);
    
    expect(result1.value).equal(result2.value);
  });

  test("should use uniform distribution", () => {
    const seed = createRandomSeed("uniform-test");
    const min = 0.0;
    const max = 100.0;
    
    // Generate multiple values and check they're distributed across the range
    let seedState = seed;
    let sum = 0.0;
    const count = 100;
    
    for (let i = 0; i < count; i++) {
      const result = getRandomInRange(seedState, min, max);
      expect(result.value >= min).equal(true);
      expect(result.value < max).equal(true);
      sum += result.value;
      seedState = result.seed;
    }
    
    // Average should be roughly in the middle (with some tolerance)
    const average = sum / <f64>count;
    const expectedAverage = (min + max) / 2.0;
    const tolerance = 20.0; // Allow some variance
    expect(Math.abs(average - expectedAverage) < tolerance).equal(true);
  });
});

describe("getRandomIntInRange", () => {
  test("should return integer in specified range", () => {
    const seed = createRandomSeed("int-test");
    const result = getRandomIntInRange(seed, 0, 100);
    
    const intValue = <i32>result.value;
    expect(intValue >= 0).equal(true);
    expect(intValue < 100).equal(true);
  });

  test("should return integer value", () => {
    const seed = createRandomSeed("int-test");
    const result = getRandomIntInRange(seed, 10, 20);
    
    const intValue = <i32>result.value;
    const isInteger = intValue == result.value;
    expect(isInteger).equal(true);
  });

  test("should handle negative integer ranges", () => {
    const seed = createRandomSeed("negative-int");
    const result = getRandomIntInRange(seed, -10, 10);
    
    const intValue = <i32>result.value;
    expect(intValue >= -10).equal(true);
    expect(intValue < 10).equal(true);
  });

  test("should increment seed index", () => {
    const seed = createRandomSeed("test");
    const result = getRandomIntInRange(seed, 0, 10);
    
    expect(result.seed.index).equal(1);
  });

  test("should produce deterministic values for same seed", () => {
    const seed1 = createRandomSeed("deterministic-int");
    const seed2 = createRandomSeed("deterministic-int");
    
    const result1 = getRandomIntInRange(seed1, 0, 100);
    const result2 = getRandomIntInRange(seed2, 0, 100);
    
    expect(result1.value).equal(result2.value);
  });

  test("should respect range boundaries", () => {
    const seed = createRandomSeed("boundary-test");
    
    // Test multiple calls to ensure we hit boundaries
    let seedState = seed;
    for (let i = 0; i < 1000; i++) {
      const result = getRandomIntInRange(seedState, 0, 5);
      const intValue = <i32>result.value;
      expect(intValue >= 0).equal(true);
      expect(intValue < 5).equal(true);
      seedState = result.seed;
    }
  });
});

describe("Random Seed Integration", () => {
  test("should maintain state across multiple random calls", () => {
    const seed = createRandomSeed("integration-test");
    
    const r1 = getRandomValue(seed);
    expect(r1.seed.index).equal(1);
    
    const r2 = getRandomValue(r1.seed);
    expect(r2.seed.index).equal(2);
    
    const r3 = getRandomValue(r2.seed);
    expect(r3.seed.index).equal(3);
    
    // All values should be different
    expect(r1.value).not.equal(r2.value);
    expect(r2.value).not.equal(r3.value);
  });

  test("should work with mixed random functions", () => {
    const seed = createRandomSeed("mixed-test");
    
    const r1 = getRandomValue(seed);
    const r2 = getRandomInRange(r1.seed, 0.0, 10.0);
    const r3 = getRandomIntInRange(r2.seed, 0, 100);
    
    expect(r1.seed.index).equal(1);
    expect(r2.seed.index).equal(2);
    expect(r3.seed.index).equal(3);
  });

  test("should produce reproducible sequences", () => {
    const seed1 = createRandomSeed("reproducible");
    const seed2 = createRandomSeed("reproducible");
    
    // Generate sequence from both seeds and compare each value
    let s1 = seed1;
    let s2 = seed2;
    
    for (let i = 0; i < 10; i++) {
      const result1 = getRandomValue(s1);
      const result2 = getRandomValue(s2);
      
      expect(result1.value).equal(result2.value);
      
      s1 = result1.seed;
      s2 = result2.seed;
    }
  });
});


