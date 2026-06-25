/**
 * Comprehensive statistical analysis of the randomness implementation.
 * 
 * This script tests the @core random implementation for:
 * 1. Distribution uniformity (Chi-square test)
 * 2. Serial correlation (consecutive value patterns)
 * 3. Run length analysis (streaks of same outcomes)
 * 4. Specific roshambo simulation
 */

// Replicate the AssemblyScript random implementation in JavaScript
class RandomSeed {
  constructor(baseSeed, index = 0) {
    this.baseSeed = baseSeed;
    this.index = index;
  }

  increment() {
    return new RandomSeed(this.baseSeed, this.index + 1);
  }
}

// =============================================================================
// OLD BROKEN IMPLEMENTATION (for comparison)
// =============================================================================

function hashRandomSeed_OLD(seed) {
  let baseHash = 0;
  for (let i = 0; i < seed.baseSeed.length; i++) {
    const char = seed.baseSeed.charCodeAt(i);
    baseHash = (baseHash * 31 + char) | 0;
  }
  const indexHash = (seed.index * 1000003) | 0;
  const finalHash = (baseHash + indexHash) | 0;
  return finalHash;
}

function deterministicRandom_OLD(hash) {
  const a = 1664525;
  const c = 1013904223;
  let seed = hash >>> 0;
  const product = BigInt(seed) * BigInt(a);
  const sum = product + BigInt(c);
  const next = Number(sum & 0xFFFFFFFFn);
  return next / 4294967296.0;
}

function getRandomValue_OLD(seed) {
  const hash = hashRandomSeed_OLD(seed);
  const randomValue = deterministicRandom_OLD(hash);
  const newSeed = seed.increment();
  return { value: randomValue, seed: newSeed };
}

// =============================================================================
// NEW FIXED IMPLEMENTATION
// =============================================================================

/**
 * 32-bit mixing function (MurmurHash3 finalizer style)
 */
function mix32(x) {
  x = x >>> 0; // Ensure unsigned
  x ^= x >>> 16;
  x = Math.imul(x, 0x85ebca6b) >>> 0;
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35) >>> 0;
  x ^= x >>> 16;
  return x >>> 0;
}

function hashRandomSeed(seed) {
  // FNV-1a hash for string
  let h = 2166136261 >>> 0; // FNV offset basis
  for (let i = 0; i < seed.baseSeed.length; i++) {
    const char = seed.baseSeed.charCodeAt(i);
    h ^= char;
    h = Math.imul(h, 16777619) >>> 0; // FNV prime
  }
  
  // Combine with index using XOR and mixing
  const indexBits = mix32(seed.index >>> 0);
  h ^= indexBits;
  
  // Final mixing pass
  h = mix32(h);
  
  return h | 0;
}

function deterministicRandom(hash) {
  let state = (hash >>> 0) + 0x9e3779b9; // Golden ratio constant
  state = state >>> 0;
  state = mix32(state);
  return state / 4294967296.0;
}

function getRandomValue(seed) {
  const hash = hashRandomSeed(seed);
  const randomValue = deterministicRandom(hash);
  const newSeed = seed.increment();
  return { value: randomValue, seed: newSeed };
}

// =============================================================================
// STATISTICAL TESTS
// =============================================================================

console.log("╔════════════════════════════════════════════════════════════════╗");
console.log("║          RANDOMNESS ANALYSIS FOR @arcanahq/core                  ║");
console.log("╚════════════════════════════════════════════════════════════════╝");
console.log();

// Test 1: Check the linear correlation in consecutive outputs
console.log("═══════════════════════════════════════════════════════════════════");
console.log("TEST 1: CONSECUTIVE VALUE DIFFERENCE ANALYSIS");
console.log("═══════════════════════════════════════════════════════════════════");

const baseSeed = "test-seed-12345";
let seed = new RandomSeed(baseSeed, 0);
const values = [];
const differences = [];

for (let i = 0; i < 20; i++) {
  const result = getRandomValue(seed);
  values.push(result.value);
  if (i > 0) {
    let diff = result.value - values[i - 1];
    if (diff < 0) diff += 1; // Wrap around
    differences.push(diff);
  }
  seed = result.seed;
}

console.log("\nFirst 10 random values:");
for (let i = 0; i < 10; i++) {
  console.log(`  Index ${i}: ${values[i].toFixed(6)}`);
}

console.log("\nDifferences between consecutive values (should be random, not constant):");
for (let i = 0; i < Math.min(9, differences.length); i++) {
  console.log(`  diff[${i}→${i+1}]: ${differences[i].toFixed(6)}`);
}

const avgDiff = differences.reduce((a, b) => a + b, 0) / differences.length;
const stdDiff = Math.sqrt(differences.reduce((a, b) => a + Math.pow(b - avgDiff, 2), 0) / differences.length);

console.log(`\n  Average difference: ${avgDiff.toFixed(6)}`);
console.log(`  Std deviation:      ${stdDiff.toFixed(6)}`);
console.log(`\n  ⚠️  If std deviation is very small, there's a linear correlation problem!`);
if (stdDiff < 0.1) {
  console.log(`  ❌ PROBLEM DETECTED: Consecutive values have nearly constant difference!`);
} else {
  console.log(`  ✅ Consecutive values appear sufficiently random.`);
}

// Test 2: Roshambo Simulation (Rock-Paper-Scissors)
console.log("\n═══════════════════════════════════════════════════════════════════");
console.log("TEST 2: ROSHAMBO (ROCK-PAPER-SCISSORS) SIMULATION");
console.log("═══════════════════════════════════════════════════════════════════");

function simulateRoshambo(numGames, baseSeed) {
  let seed = new RandomSeed(baseSeed, 0);
  const choices = { 0: 0, 1: 0, 2: 0 }; // rock, paper, scissors counts
  const streaks = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, "6+": 0 };
  const sequencePatterns = {};
  
  let currentStreak = 0;
  let lastChoice = -1;
  let lastThree = [];
  
  for (let i = 0; i < numGames; i++) {
    // Get AI's random choice
    const result = getRandomValue(seed);
    const choice = Math.floor(result.value * 3);
    choices[choice]++;
    
    // Track streaks (same outcome in a row)
    if (choice === lastChoice) {
      currentStreak++;
    } else {
      if (currentStreak > 0) {
        const streakKey = currentStreak >= 6 ? "6+" : currentStreak;
        streaks[streakKey]++;
      }
      currentStreak = 1;
    }
    lastChoice = choice;
    
    // Track 3-element patterns
    lastThree.push(choice);
    if (lastThree.length > 3) lastThree.shift();
    if (lastThree.length === 3) {
      const pattern = lastThree.join(",");
      sequencePatterns[pattern] = (sequencePatterns[pattern] || 0) + 1;
    }
    
    seed = result.seed;
  }
  
  return { choices, streaks, sequencePatterns };
}

const numGames = 10000;
const roshamboResult = simulateRoshambo(numGames, "roshambo-test-123");

console.log(`\nSimulated ${numGames} games:`);
console.log(`\nChoice Distribution (should each be ~${(numGames/3).toFixed(0)}):`);
console.log(`  Rock (0):     ${roshamboResult.choices[0]} (${(roshamboResult.choices[0]/numGames*100).toFixed(1)}%)`);
console.log(`  Paper (1):    ${roshamboResult.choices[1]} (${(roshamboResult.choices[1]/numGames*100).toFixed(1)}%)`);
console.log(`  Scissors (2): ${roshamboResult.choices[2]} (${(roshamboResult.choices[2]/numGames*100).toFixed(1)}%)`);

// Chi-square test for uniformity
const expected = numGames / 3;
let chiSquare = 0;
for (let i = 0; i < 3; i++) {
  chiSquare += Math.pow(roshamboResult.choices[i] - expected, 2) / expected;
}
console.log(`\nChi-square statistic: ${chiSquare.toFixed(4)}`);
console.log(`  (Critical value at 95% confidence, df=2: 5.991)`);
if (chiSquare > 5.991) {
  console.log(`  ❌ Distribution is NOT uniform at 95% confidence!`);
} else {
  console.log(`  ✅ Distribution passes uniformity test.`);
}

// Test 3: Streak Analysis
console.log("\n═══════════════════════════════════════════════════════════════════");
console.log("TEST 3: STREAK (RUN LENGTH) ANALYSIS");
console.log("═══════════════════════════════════════════════════════════════════");

// For truly random with p=1/3, probability of streak of length k is:
// P(k) = (1/3)^(k-1) * (2/3) for k < max
// Expected streaks in 10000 games:
// Length 1: ~6667
// Length 2: ~2222
// Length 3: ~740
// Length 4: ~247
// Length 5: ~82
// Length 6+: ~41

const expectedStreaks = {
  1: numGames * (2/3),
  2: numGames * (1/3) * (2/3),
  3: numGames * Math.pow(1/3, 2) * (2/3),
  4: numGames * Math.pow(1/3, 3) * (2/3),
  5: numGames * Math.pow(1/3, 4) * (2/3),
  "6+": numGames * Math.pow(1/3, 5),
};

console.log("\nStreak Length Distribution:");
console.log("  Length  |  Observed  |  Expected  |  Deviation");
console.log("  --------|------------|------------|------------");

let totalStreakDeviation = 0;
for (const len of [1, 2, 3, 4, 5, "6+"]) {
  const observed = roshamboResult.streaks[len];
  const expected = expectedStreaks[len];
  const deviation = ((observed - expected) / expected * 100).toFixed(1);
  totalStreakDeviation += Math.abs(observed - expected) / expected;
  console.log(`     ${len}    |   ${observed.toString().padStart(5)}    |  ${expected.toFixed(0).padStart(5)}     |  ${deviation}%`);
}

if (totalStreakDeviation > 1.5) {
  console.log(`\n  ❌ PROBLEM: Streak distribution deviates significantly from expected!`);
  console.log(`     This explains why you "barely ever get two wins in a row".`);
} else {
  console.log(`\n  ✅ Streak distribution is within acceptable range.`);
}

// Test 4: Pattern Analysis
console.log("\n═══════════════════════════════════════════════════════════════════");
console.log("TEST 4: THREE-ELEMENT SEQUENCE PATTERN ANALYSIS");
console.log("═══════════════════════════════════════════════════════════════════");

// With 3 choices, there are 27 possible 3-element patterns
// Each should appear with probability (1/3)^3 = 1/27 ≈ 3.7%
const expectedPatternCount = (numGames - 2) / 27;

console.log(`\nExpected count per pattern: ~${expectedPatternCount.toFixed(0)}`);
console.log("\nTop 10 most common patterns:");

const sortedPatterns = Object.entries(roshamboResult.sequencePatterns)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10);

for (const [pattern, count] of sortedPatterns) {
  const labels = pattern.split(",").map(c => ["R", "P", "S"][c]).join("");
  const deviation = ((count - expectedPatternCount) / expectedPatternCount * 100).toFixed(1);
  console.log(`  ${labels}: ${count} (${deviation}% from expected)`);
}

console.log("\nBottom 10 least common patterns:");
const bottomPatterns = Object.entries(roshamboResult.sequencePatterns)
  .sort((a, b) => a[1] - b[1])
  .slice(0, 10);

for (const [pattern, count] of bottomPatterns) {
  const labels = pattern.split(",").map(c => ["R", "P", "S"][c]).join("");
  const deviation = ((count - expectedPatternCount) / expectedPatternCount * 100).toFixed(1);
  console.log(`  ${labels}: ${count} (${deviation}% from expected)`);
}

// Test 5: Serial Correlation Coefficient
console.log("\n═══════════════════════════════════════════════════════════════════");
console.log("TEST 5: SERIAL CORRELATION COEFFICIENT");
console.log("═══════════════════════════════════════════════════════════════════");

// Generate a longer sequence for correlation analysis
seed = new RandomSeed("correlation-test", 0);
const longSequence = [];
for (let i = 0; i < 1000; i++) {
  const result = getRandomValue(seed);
  longSequence.push(result.value);
  seed = result.seed;
}

// Calculate lag-1 serial correlation
const n = longSequence.length;
const mean = longSequence.reduce((a, b) => a + b) / n;
let numerator = 0;
let denominator = 0;

for (let i = 0; i < n - 1; i++) {
  numerator += (longSequence[i] - mean) * (longSequence[i + 1] - mean);
}
for (let i = 0; i < n; i++) {
  denominator += Math.pow(longSequence[i] - mean, 2);
}

const correlation = numerator / denominator;
console.log(`\nLag-1 Serial Correlation: ${correlation.toFixed(6)}`);
console.log(`  (Should be close to 0 for good randomness)`);
console.log(`  Acceptable range: -0.1 to 0.1`);

if (Math.abs(correlation) > 0.1) {
  console.log(`\n  ❌ PROBLEM: Strong serial correlation detected!`);
  console.log(`     Consecutive random values are NOT independent!`);
} else if (Math.abs(correlation) > 0.05) {
  console.log(`\n  ⚠️  Mild serial correlation detected.`);
} else {
  console.log(`\n  ✅ Serial correlation is acceptable.`);
}

// Summary
console.log("\n╔════════════════════════════════════════════════════════════════╗");
console.log("║                        SUMMARY                                 ║");
console.log("╚════════════════════════════════════════════════════════════════╝");
console.log();

let testsPassed = 0;
let testsFailed = 0;

if (stdDiff < 0.1) testsFailed++; else testsPassed++;
if (chiSquare > 5.991) testsFailed++; else testsPassed++;
if (totalStreakDeviation > 1.5) testsFailed++; else testsPassed++;
if (Math.abs(correlation) > 0.1) testsFailed++; else testsPassed++;

if (testsFailed === 0) {
  console.log("✅ ALL TESTS PASSED - The FIXED implementation provides high-quality randomness!");
  console.log();
  console.log("The new implementation uses:");
  console.log("  1. FNV-1a hash for string hashing (better than djb2)");
  console.log("  2. MurmurHash3-style bit mixing (excellent avalanche)");
  console.log("  3. XOR-based index combination (not addition!)");
  console.log("  4. SplitMix32 for final value generation");
} else {
  console.log(`❌ ${testsFailed} TEST(S) FAILED`);
  console.log();
  console.log("Root Cause (OLD implementation):");
  console.log("─────────────────────────────────");
  console.log("The hash function uses: finalHash = baseHash + (index * 1000003)");
  console.log("This means consecutive indices differ by exactly 1,000,003.");
  console.log();
  console.log("When fed to the LCG: output = (a * hash + c) mod 2^32");
  console.log("Consecutive outputs differ by: a * 1000003 mod 2^32");
  console.log(`  = 1664525 * 1000003 mod 2^32 = ${(1664525 * 1000003) >>> 0}`);
  console.log(`  As fraction of range: ${((1664525 * 1000003) >>> 0) / 4294967296}`);
  console.log();
  console.log("This creates a LINEAR relationship between consecutive random values!");
}

// Compare OLD vs NEW
console.log("\n\n═══════════════════════════════════════════════════════════════════");
console.log("COMPARISON: OLD vs NEW IMPLEMENTATION");
console.log("═══════════════════════════════════════════════════════════════════");

console.log("\n--- OLD (Broken) Implementation ---");
let oldSeed = new RandomSeed("comparison-test", 0);
const oldValues = [];
for (let i = 0; i < 10; i++) {
  const result = getRandomValue_OLD(oldSeed);
  oldValues.push(result.value);
  oldSeed = result.seed;
}

console.log("First 5 values:", oldValues.slice(0, 5).map(v => v.toFixed(4)).join(", "));
const oldDiffs = [];
for (let i = 1; i < oldValues.length; i++) {
  let diff = oldValues[i] - oldValues[i-1];
  if (diff < 0) diff += 1;
  oldDiffs.push(diff);
}
const oldDiffStd = Math.sqrt(oldDiffs.reduce((a, b) => a + Math.pow(b - oldDiffs.reduce((x, y) => x + y) / oldDiffs.length, 2), 0) / oldDiffs.length);
console.log(`Consecutive diff std deviation: ${oldDiffStd.toFixed(6)} (should be ~0.29 for random)`);

console.log("\n--- NEW (Fixed) Implementation ---");
let newSeed = new RandomSeed("comparison-test", 0);
const newValues = [];
for (let i = 0; i < 10; i++) {
  const result = getRandomValue(newSeed);
  newValues.push(result.value);
  newSeed = result.seed;
}

console.log("First 5 values:", newValues.slice(0, 5).map(v => v.toFixed(4)).join(", "));
const newDiffs = [];
for (let i = 1; i < newValues.length; i++) {
  let diff = newValues[i] - newValues[i-1];
  if (diff < 0) diff += 1;
  newDiffs.push(diff);
}
const newDiffStd = Math.sqrt(newDiffs.reduce((a, b) => a + Math.pow(b - newDiffs.reduce((x, y) => x + y) / newDiffs.length, 2), 0) / newDiffs.length);
console.log(`Consecutive diff std deviation: ${newDiffStd.toFixed(6)} (should be ~0.29 for random)`);

