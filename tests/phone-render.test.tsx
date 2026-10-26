import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
(globalThis as unknown as { React: unknown }).React = React;
// react.cache exists only in the server build of React; the test only renders PhoneList, so a passthrough is enough.
(React as unknown as { cache?: unknown }).cache ??= (f: unknown) => f;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PhoneList } = require("../src/components/ResidentContacts");
let fails = 0;
const hrefs = (p: string | null) => [...renderToStaticMarkup(<PhoneList phone={p} />).matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
function ok(n: string, c: boolean) { console.log((c ? "ok  " : "FAIL") + " " + n); if (!c) fails++; }
ok("single -> one tel", JSON.stringify(hrefs("050-123 4567")) === '["tel:0501234567"]');
ok("two -> two separate tels", JSON.stringify(hrefs("050-1234567, 052-7654321")) === '["tel:0501234567","tel:0527654321"]');
ok("international keeps +", JSON.stringify(hrefs("+972501234567")) === '["tel:+972501234567"]');
ok("empty -> no link + message", hrefs("").length === 0 && renderToStaticMarkup(<PhoneList phone="" />).includes("לא הוזן טלפון"));
ok("undecodable -> original text, no link", hrefs("בערב בלבד").length === 0 && renderToStaticMarkup(<PhoneList phone="בערב בלבד" />).includes("בערב בלבד"));
ok("ltr number display", renderToStaticMarkup(<PhoneList phone="0501234567" />).includes('dir="ltr"'));
process.exit(fails ? 1 : 0);
