// חסימת שיוך החזרי ליבנה 4: בכספים, בבורר המקורות, בכתובת ישירה ובבקשת שרת - על נתוני דמה בלבד.
import assert from "node:assert/strict";
import {
  assertAllocatable, isLivna4Refund, partitionAllocatable,
  LIVNA4_REFUND_BLOCK, LIVNA4_REFUND_NOTE, type UnallocatedSource,
} from "../src/lib/income-classes";

const S = (description: string | null, amount: number, extra: Partial<UnallocatedSource> = {}): UnallocatedSource => ({
  id: extra.id ?? "tx", date: "2026-10-25", amount, allocated: 0, available: amount, description, ...extra,
});

const refund = S("העברה מאת: ועד בית ליבנה 4 הפרש חשמל משותף ליבנה 4", 204.59, { id: "r1" });
const refund2 = S("ועד בית ליבנה 4 חשמל משותף", 100, { id: "r2" });
const resident = S("העברה מאת: בליטי רז משפחת אוחיון דירה 11", 1700, { id: "t1" });
const apt4 = S("העברה מאת: כהן דירה 4", 330, { id: "t2" }); // דירה 4 בבניין שלנו - לא החזר מליבנה 4
const partial = S("העברה מאת: לוי דירה 9", 330, { id: "t3", allocated: 200, available: 130 }); // שיוך חלקי קודם
const review = S("העברה מאת: לוי חשמל ליבנה 4", 8168.45, { id: "u1" }); // needs_review: לא מנחשים, לא חוסמים

// בבורר המקורות ובכספים: ההחזרים יוצאים מהבחירה, כל השאר נשאר.
const { allocatable, refunds } = partitionAllocatable([refund, refund2, resident, apt4, partial, review]);
assert.deepEqual(refunds.map((s) => s.id), ["r1", "r2"]);
assert.deepEqual(allocatable.map((s) => s.id), ["t1", "t2", "t3", "u1"]);

// כתובת ישירה עם מזהה של החזר: נמצא ברשימת החסומים ולא בבחירה.
const blockedTx = refunds.some((s) => s.id === "r1") ? "r1" : undefined;
assert.equal(blockedTx, "r1");
assert.equal(allocatable.some((s) => s.id === "r1"), false);

// בקשת שרת: החזר נדחה בהודעה עברית; דייר רגיל, דירה 4, חלקי וממתין סיווג - עוברים בלי שינוי.
assert.throws(() => assertAllocatable({ description: refund.description }), new Error(`LIVNA4_REFUND: ${LIVNA4_REFUND_BLOCK}`));
assertAllocatable({ description: resident.description });
assertAllocatable({ description: apt4.description });
assertAllocatable({ description: partial.description });
assertAllocatable({ description: review.description });
assertAllocatable({ description: null });
assertAllocatable({ description: refund.description, category_name: "ועד בית" }); // סיווג מפורש של דייר גובר - needs_review, לא חסום
assertAllocatable({ description: refund.description, apartment_id: "apt-x" });

// תשלום חדש עם שיוכים: תיאור של החזר נדחה גם בלי מזהה קיים.
assert.throws(() => assertAllocatable({ description: "העברה מאת: ועד בית ליבנה 4" }), /LIVNA4_REFUND/);

// הודעות אחידות.
assert.equal(LIVNA4_REFUND_NOTE, "החזר מליבנה 4 - הכנסה של הבניין, לא תשלום דייר");
assert.ok(LIVNA4_REFUND_BLOCK.includes("לא ניתן לשייך"));

// ניסיון חסום אינו משנה את המקורות: אובייקטי הקלט לא השתנו.
assert.equal(refund.available, 204.59);
assert.equal(partial.available, 130);
assert.equal(isLivna4Refund(refund), true);
assert.equal(isLivna4Refund(apt4), false);

console.log("livna4-allocation tests passed");
