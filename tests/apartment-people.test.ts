import assert from "node:assert/strict";
import { livingResidentLabels, peopleByApartment, type DirectoryPerson } from "../src/lib/apartment-people";
const P = (apartment_id: string, full_name: string | null, lives_here: boolean, ownership: string): DirectoryPerson => ({ apartment_id, full_name, lives_here, ownership });
const dir = [P("a", "דנה", true, "owner"), P("a", "רן", true, "owner"), P("b", "שרה", true, "tenant"), P("b", "בעל דירה", false, "owner"), P("c", "בעלים רחוק", false, "owner"), P("d", "  ", true, "owner"), P("e", null, true, "tenant")];
assert.deepEqual(livingResidentLabels("a", dir), ["דנה", "רן"]);
assert.deepEqual(livingResidentLabels("b", dir), ["שרה (שוכר/ת)"]); // שוכר מוצג, הבעלים שאינו מתגורר לא מחליף אותו
assert.deepEqual(livingResidentLabels("c", dir), []); // בעלים שאינו מתגורר ואין שוכר: אין שם
assert.deepEqual(livingResidentLabels("d", dir), []); // שם ריק
assert.deepEqual(livingResidentLabels("e", dir), []); // שם חסר
assert.deepEqual(livingResidentLabels("zzz", dir), []);
const m = peopleByApartment(dir);
assert.deepEqual([...m.keys()].sort(), ["a", "b"]);
console.log("apartment-people tests passed");
