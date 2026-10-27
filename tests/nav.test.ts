import assert from "node:assert/strict";
import { TABS, activeTab, moreGroupsFor } from "../src/lib/nav";

// 1. חמש לשוניות זהות לדייר ולוועד, בסדר הנדרש, עם הכתובות הקיימות
assert.deepEqual(TABS.map((t) => t.label), ["ראשי", "כספים", "דיירים", "תקלות", "עוד"]);
assert.deepEqual(TABS.map((t) => t.href), ["/dashboard", "/finances", "/apartments", "/requests", "/more"]);

// 2. אף יכולת לא נעלמה: כל הקישורים הישנים של מסך הניהול והניווט הישן נגישים
const tabHrefs = TABS.map((t) => t.href);
const adminHrefs = new Set([...tabHrefs, ...moreGroupsFor(true).flatMap((g) => g.items.map((i) => i.href))]);
const oldManage = ["/manage/fees", "/payments", "/finances", "/forecast", "/manage/opening-balance", "/finances/import", "/manage/suppliers", "/manage/apartments", "/requests", "/projects", "/announcements", "/manage/tasks", "/manage/documents", "/manage/audit", "/manage/deleted", "/manage/join-requests", "/manage/users", "/account", "/changelog"];
const newThisRelease = ["/manage/collection", "/payments/allocate"];
const oldAdminNav = ["/dashboard", "/finances", "/forecast", "/apartments", "/requests", "/manage"];
for (const h of [...oldManage, ...newThisRelease, ...oldAdminNav.filter((h) => h !== "/manage")]) assert.ok(adminHrefs.has(h), `ועד: חסר ${h}`);

const residentHrefs = new Set([...tabHrefs, ...moreGroupsFor(false).flatMap((g) => g.items.map((i) => i.href))]);
for (const h of ["/dashboard", "/finances", "/forecast", "/apartments", "/requests", "/projects", "/announcements", "/account"]) assert.ok(residentHrefs.has(h), `דייר: חסר ${h}`);

// 3. דייר לא רואה קישורי ועד; ועד לא רואה את קבוצות הדייר הכפולות
for (const h of residentHrefs) assert.ok(!h.startsWith("/manage") && h !== "/payments" && h !== "/payments/allocate" && h !== "/finances/import", `דייר רואה קישור ועד: ${h}`);
assert.deepEqual(moreGroupsFor(true).map((g) => g.id), ["finance", "ops", "committee", "settings"]);
assert.deepEqual(moreGroupsFor(false).map((g) => g.id), ["building", "account"]);
for (const g of moreGroupsFor(true)) assert.equal(new Set(g.items.map((i) => i.href)).size, g.items.length, `כפילות בקבוצה ${g.id}`);
const committee = moreGroupsFor(true).find((g) => g.id === "committee")!;
assert.deepEqual(committee.items.map((i) => i.href), ["/manage/tasks", "/manage/documents"]);

// 4. סימון לשונית פעילה, כולל עמודים פנימיים
const cases: [string, string | null][] = [
  ["/dashboard", "home"], ["/finances", "finance"], ["/finances/import", "finance"], ["/payments", "finance"], ["/payments/allocate", "finance"],
  ["/forecast", "finance"], ["/manage/fees", "finance"], ["/manage/collection", "finance"], ["/manage/opening-balance", "finance"], ["/manage/suppliers", "finance"],
  ["/apartments", "residents"], ["/manage/apartments", "residents"], ["/manage/apartments/abc", "residents"],
  ["/requests", "issues"], ["/requests/123", "issues"],
  ["/more", "more"], ["/manage", "more"], ["/manage/tasks", "more"], ["/manage/documents", "more"], ["/manage/users", "more"], ["/manage/join-requests", "more"],
  ["/manage/audit", "more"], ["/manage/deleted", "more"], ["/projects", "more"], ["/announcements", "more"], ["/account", "more"], ["/changelog", "more"],
  ["/login", null], ["/finances/", "finance"], ["/payments?year=2026", "finance"],
];
for (const [p, tab] of cases) assert.equal(activeTab(p), tab, `activeTab(${p})`);
// קידומת דומה אינה תופסת לשונית אחרת
assert.equal(activeTab("/requestsX"), null);
assert.equal(activeTab("/financesX"), null);
console.log("nav tests passed");
