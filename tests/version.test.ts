import { readFileSync } from "node:fs";
import { APP_VERSION, CHANGELOG } from "../src/lib/version";
let fails = 0;
function ok(n: string, c: boolean) { console.log((c ? "ok  " : "FAIL") + " " + n); if (!c) fails++; }
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const semver = /^\d+\.\d+\.\d+$/;
const cmp = (a: string, b: string) => { const x = a.split(".").map(Number), y = b.split(".").map(Number); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };
ok("package.json version equals APP_VERSION", pkg.version === APP_VERSION);
ok("top changelog entry equals APP_VERSION", CHANGELOG[0]?.version === APP_VERSION);
ok("all versions are semver", CHANGELOG.every((c) => semver.test(c.version)));
ok("versions strictly descending", CHANGELOG.every((c, i) => i === 0 || cmp(CHANGELOG[i - 1].version, c.version) > 0));
ok("no duplicate versions", new Set(CHANGELOG.map((c) => c.version)).size === CHANGELOG.length);
ok("every entry has date, title and changes", CHANGELOG.every((c) => /^\d{4}-\d{2}-\d{2}$/.test(c.date) && c.title && c.changes.length > 0));
if (fails) process.exit(1);
console.log("all passed");
