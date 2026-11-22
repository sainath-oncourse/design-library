// Copies the app screens and animations captured in the screen library into this site.
// Run: node sync-screens.mjs [path to screen-library]   (default ~/Documents/screen-library), then node build.mjs
import { readFileSync, writeFileSync, cpSync, rmSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const from = process.argv[2] || join(homedir(), "Documents/screen-library");
if (!existsSync(join(from, "data/screens.json"))) throw new Error(`No screen library at ${from}`);

const screens = JSON.parse(readFileSync(join(from, "data/screens.json"), "utf8"));
const apps = existsSync(join(from, "data/apps.json")) ? JSON.parse(readFileSync(join(from, "data/apps.json"), "utf8")) : {};

rmSync("screens", { recursive: true, force: true });
cpSync(join(from, "screens"), "screens", { recursive: true });
for (const s of screens) for (const f of [s.file, s.poster].filter(Boolean)) if (!existsSync(f)) throw new Error(`Missing file: ${f}`);

writeFileSync("data/screens.json", JSON.stringify({ apps, screens }, null, 1) + "\n");
console.log(`Synced ${screens.length} captures from ${new Set(screens.map((s) => s.app)).size} apps`);
