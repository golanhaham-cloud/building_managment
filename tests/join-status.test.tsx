import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
(globalThis as unknown as { React: unknown }).React = React;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const JoinStatus = require("../src/app/claim/JoinStatus").default;
let fails = 0;
function ok(n: string, c: boolean) { console.log((c ? "ok  " : "FAIL") + " " + n); if (!c) fails++; }
const pend = renderToStaticMarkup(<JoinStatus status="pending" email="a@b.co" requestedAt="2026-10-24T08:00:00Z" />);
const rej = renderToStaticMarkup(<JoinStatus status="rejected" email="a@b.co" requestedAt="2026-10-24T08:00:00Z" />);
ok("pending shows required message", pend.includes("הבקשה נשלחה לוועד וממתינה לאישור"));
ok("pending has logout and status check only (no nav links)", pend.includes("יציאה מהחשבון") && pend.includes("בדיקת מצב הבקשה") && !pend.includes("href="));
ok("rejected shows rejection message, no re-request form", rej.includes("הבקשה לא אושרה") && !rej.includes("<input") && rej.includes("יציאה מהחשבון"));
ok("rejected does not leak internal reason field", !rej.includes("reject_reason"));
process.exit(fails ? 1 : 0);
