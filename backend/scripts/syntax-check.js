import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
const files = [];
(function walk(d) { for (const f of readdirSync(d)) { if (f === "node_modules") continue; const p = join(d, f); statSync(p).isDirectory() ? walk(p) : p.endsWith(".js") && files.push(p); } })(".");
let bad = 0;
for (const f of files) { const r = spawnSync(process.execPath, ["--check", f]); if (r.status !== 0) { bad++; console.error(r.stderr.toString()); } }
console.log(`${files.length} files checked, ${bad} failed`);
process.exit(bad ? 1 : 0);
