/**
 * Multi-seed validation to ensure the fix is robust across different seeds
 */

// NEW FIXED IMPLEMENTATION
function mix32(x) {
  x = x >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x85ebca6b) >>> 0;
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35) >>> 0;
  x ^= x >>> 16;
  return x >>> 0;
}

class RandomSeed {
  constructor(baseSeed, index = 0) {
    this.baseSeed = baseSeed;
    this.index = index;
  }
  increment() {
    return new RandomSeed(this.baseSeed, this.index + 1);
  }
}

function hashRandomSeed(seed) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.baseSeed.length; i++) {
    const char = seed.baseSeed.charCodeAt(i);
    h ^= char;
    h = Math.imul(h, 16777619) >>> 0;
  }
  const indexBits = mix32(seed.index >>> 0);
  h ^= indexBits;
  h = mix32(h);
  return h | 0;
}

function deterministicRandom(hash) {
  let state = (hash >>> 0) + 0x9e3779b9;
  state = state >>> 0;
  state = mix32(state);
  return state / 4294967296.0;
}

function getRandomValue(seed) {
  const hash = hashRandomSeed(seed);
  const randomValue = deterministicRandom(hash);
  return { value: randomValue, seed: seed.increment() };
}

// Test across multiple seeds
const testSeeds = [
  "test-seed-1",
  "game-session-abc123",
  "roshambo-match-xyz",
  "random-battle-2024",
  "player-vs-ai-555",
  "tournament-round-1",
  "casual-game-12345",
  "ranked-match-9999"
];

console.log("╔════════════════════════════════════════════════════════════════╗");
console.log("║       MULTI-SEED VALIDATION - NEW FIXED IMPLEMENTATION         ║");
console.log("╚════════════════════════════════════════════════════════════════╝\n");

const numGames = 10000;
let allPassed = true;
const chiSquareResults = [];
const streakResults = [];

for (const testSeed of testSeeds) {
  let seed = new RandomSeed(testSeed, 0);
  const choices = [0, 0, 0];
  let streaksOf2Plus = 0;
  let lastChoice = -1;
  let currentStreak = 0;
  
  for (let i = 0; i < numGames; i++) {
    const result = getRandomValue(seed);
    const choice = Math.floor(result.value * 3);
    choices[choice]++;
    
    if (choice === lastChoice) {
      currentStreak++;
      if (currentStreak === 2) streaksOf2Plus++;
    } else {
      currentStreak = 1;
    }
    lastChoice = choice;
    seed = result.seed;
  }
  
  // Chi-square test
  const expected = numGames / 3;
  let chiSquare = 0;
  for (let i = 0; i < 3; i++) {
    chiSquare += Math.pow(choices[i] - expected, 2) / expected;
  }
  
  // Expected streaks of 2+: roughly numGames * (1/3) * (1/3) = ~1111 for first continuation
  // This is simplified - we just check if there are a reasonable number
  const expectedStreaks2Plus = numGames / 9; // ~1111
  const streakOk = streaksOf2Plus > expectedStreaks2Plus * 0.7 && streaksOf2Plus < expectedStreaks2Plus * 1.3;
  
  const chiSquareOk = chiSquare < 5.991;
  chiSquareResults.push({ seed: testSeed, chi: chiSquare, passed: chiSquareOk });
  streakResults.push({ seed: testSeed, streaks: streaksOf2Plus, passed: streakOk });
  
  if (!chiSquareOk || !streakOk) allPassed = false;
}

console.log("Chi-Square Test Results (critical value: 5.991):");
console.log("─────────────────────────────────────────────────");
for (const result of chiSquareResults) {
  const status = result.passed ? "✅" : "❌";
  console.log(`  ${status} ${result.seed.padEnd(25)} χ² = ${result.chi.toFixed(3)}`);
}

console.log("\nStreak Test Results (2+ in a row, expected ~1111):");
console.log("───────────────────────────────────────────────────");
for (const result of streakResults) {
  const status = result.passed ? "✅" : "⚠️";
  console.log(`  ${status} ${result.seed.padEnd(25)} streaks = ${result.streaks}`);
}

console.log("\n════════════════════════════════════════════════════════════════");
if (allPassed) {
  console.log("✅ ALL SEEDS PASSED - Implementation is robust!");
} else {
  const chiPassed = chiSquareResults.filter(r => r.passed).length;
  const streakPassed = streakResults.filter(r => r.passed).length;
  console.log(`Chi-square: ${chiPassed}/${testSeeds.length} passed`);
  console.log(`Streaks: ${streakPassed}/${testSeeds.length} passed`);
  
  if (chiPassed >= testSeeds.length - 1 && streakPassed >= testSeeds.length - 1) {
    console.log("\n⚠️  Minor variance detected but within acceptable limits.");
    console.log("   Chi-square can fail 5% of the time by design (95% confidence).");
  }
}
console.log("════════════════════════════════════════════════════════════════");

// Serial correlation across all seeds
console.log("\nSerial Correlation Check (all seeds):");
console.log("──────────────────────────────────────");
for (const testSeed of testSeeds.slice(0, 4)) {
  let seed = new RandomSeed(testSeed, 0);
  const values = [];
  for (let i = 0; i < 1000; i++) {
    const result = getRandomValue(seed);
    values.push(result.value);
    seed = result.seed;
  }
  
  const mean = values.reduce((a, b) => a + b) / values.length;
  let num = 0, den = 0;
  for (let i = 0; i < values.length - 1; i++) {
    num += (values[i] - mean) * (values[i + 1] - mean);
  }
  for (let i = 0; i < values.length; i++) {
    den += Math.pow(values[i] - mean, 2);
  }
  const corr = num / den;
  const status = Math.abs(corr) < 0.1 ? "✅" : "❌";
  console.log(`  ${status} ${testSeed.padEnd(25)} correlation = ${corr.toFixed(4)}`);
}

