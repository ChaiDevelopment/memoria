// Runs Vitest with a normalised working directory.
// On Windows, starting from a lowercase drive path (e.g. "d:\memora", which some
// editors use) makes Vite load the Vitest runtime twice and every suite fails with
// "Vitest failed to find the current suite". Upper-casing the drive letter avoids it.
import { spawnSync } from "node:child_process";
import path from "node:path";

const cwd = process.cwd().replace(/^[a-z]:/, (d) => d.toUpperCase());
const vitest = path.join(cwd, "node_modules", "vitest", "vitest.mjs");
const result = spawnSync(process.execPath, [vitest, "run", ...process.argv.slice(2)], { cwd, stdio: "inherit" });
process.exit(result.status ?? 1);
