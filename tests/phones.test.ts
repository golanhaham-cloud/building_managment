import { parsePhones } from "../src/lib/phones";
let fails = 0;
function ok(name: string, cond: boolean) { console.log((cond ? "ok  " : "FAIL") + " " + name); if (!cond) fails++; }
const dials = (s: string) => { const r = parsePhones(s); return r.kind === "numbers" ? r.items.map((i) => i.dial) : r.kind; };
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

ok("single with hyphen", eq(dials("050-1234567"), ["0501234567"]));
ok("single with spaces", eq(dials("050 123 4567"), ["0501234567"]));
ok("single landline", eq(dials("03-1234567"), ["031234567"]));
ok("two by comma", eq(dials("050-1234567, 052-7654321"), ["0501234567", "0527654321"]));
ok("two by slash", eq(dials("0501234567/0527654321"), ["0501234567", "0527654321"]));
ok("two by 'או'", eq(dials("0501234567 או 0527654321"), ["0501234567", "0527654321"]));
ok("two by semicolon", eq(dials("0501234567;0527654321"), ["0501234567", "0527654321"]));
ok("two by newline", eq(dials("0501234567\n0527654321"), ["0501234567", "0527654321"]));
ok("international keeps +", eq(dials("+972 50-123-4567"), ["+972501234567"]));
ok("international other country", eq(dials("+1 (415) 555-2671"), ["+14155552671"]));
ok("empty", eq(dials(""), "empty") && eq(dials("   "), "empty") && eq(dials(null as unknown as string), "empty"));
ok("names kept with numbers", (() => { const r = parsePhones("050-1234567 דני, 052-7654321 מיכל"); return r.kind === "numbers" && r.items[0].label === "דני" && r.items[1].label === "מיכל" && r.items[1].dial === "0527654321"; })());
ok("undecodable text -> raw, no link", eq(dials("לא זמין"), "raw"));
ok("two numbers only separated by space -> raw", eq(dials("0501234567 0527654321"), "raw"));
ok("too short -> raw", eq(dials("12345"), "raw"));
ok("too long joined -> raw", eq(dials("05012345670527654321"), "raw"));
ok("one bad segment makes all raw", eq(dials("0501234567, בערב"), "raw"));
ok("no dial link ever merges digits", (() => { const r = parsePhones("050-1234567 / 052-7654321"); return r.kind === "numbers" && r.items.every((i) => i.dial.length === 10); })());
if (fails) { console.log(fails + " failed"); process.exit(1); }
console.log("all passed");
