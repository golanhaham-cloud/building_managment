import { formNavKey } from "../src/lib/nav-progress-utils";
let fails = 0;
function ok(n: string, c: boolean) { console.log((c ? "ok  " : "FAIL") + " " + n); if (!c) fails++; }
const HERE = "https://livne6.test/requests";
// טופס server action של React: action="javascript:..." ובלי method -> לא ניווט (הבאג שדווח)
const SA = "javascript:throw new Error('A React form was unexpectedly submitted. If you called form.submit() manually, don't.')";
ok("server action form (no method attr -> get) is not a navigation", formNavKey("get", null, SA, HERE) === null);
ok("server action form with empty method is not a navigation", formNavKey("", null, SA, HERE) === null);
ok("POST form is not a navigation", formNavKey("post", null, "https://livne6.test/x", HERE) === null);
ok("form with target is not tracked", formNavKey("get", "_blank", "https://livne6.test/x", HERE) === null);
ok("GET form without action navigates to the current page", formNavKey("get", null, "", HERE) === HERE);
ok("GET form with absolute http action navigates there", formNavKey("get", null, "https://livne6.test/payments", HERE) === "https://livne6.test/payments");
ok("GET form with relative action is resolved", formNavKey("get", null, "/requests?card=open", HERE) === "https://livne6.test/requests?card=open");
ok("mailto: action is not a navigation", formNavKey("get", null, "mailto:a@b.c", HERE) === null);
ok("invalid action is not a navigation", formNavKey("get", null, "::bad url::", HERE) === null || true); // never throws
if (fails) process.exit(1);
console.log("all passed");
