// apps/frontend/scripts/rebuild-sqlite.mjs
// Rebuild better-sqlite3 for the *host Node* ABI (NOT Electron).
import { spawnSync } from "node:child_process";

console.log("[rebuild-sqlite] Rebuilding better-sqlite3 for host Node…");
const result = spawnSync("pnpm", ["rebuild", "better-sqlite3", "--unsafe-perm"], {
  stdio: "inherit",
});
process.exit(result.status ?? 0);
