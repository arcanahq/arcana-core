import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { runTests } from "./runner.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const testModules = [
  { name: "index", path: join(__dirname, "../build/index.spec.wasm") },
  { name: "random", path: join(__dirname, "../build/random.spec.wasm") },
];

runTests(testModules).catch((error) => {
  console.error("Test runner failed:", error);
  process.exit(1);
});
