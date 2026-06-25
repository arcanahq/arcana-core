import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createAsTestImports } from "../core/tests/as-test-imports.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FALLBACK_HEAP_BASE = 64 * 1024;
const HEAP_REGEX = /\(global \$~lib\/memory\/__heap_base i32 \(i32\.const (\d+)\)\)/;

function resolveHeapBase() {
  const watPath = join(__dirname, ".as-test/output/test.wat");
  if (existsSync(watPath)) {
    try {
      const contents = readFileSync(watPath, "utf8");
      const match = contents.match(HEAP_REGEX);
      if (match) {
        return Number(match[1]);
      }
    } catch {
      // fall through to fallback
    }
  }
  return FALLBACK_HEAP_BASE;
}

export default {
  include: ["assembly"],
  flags: "--exportRuntime --bindings raw",
  collectCoverage: false,
  output: ".as-test/output",
  temp: ".as-test/tmp",
  imports() {
    return createAsTestImports(__dirname, { outputDir: ".as-test/output" });
  },
};

