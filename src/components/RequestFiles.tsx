"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ACCEPT, REQUEST_FILE_HINT, REQUEST_FILE_TYPES, validateFile } from "@/lib/files";
import { uploadToBucket } from "@/lib/upload";
import { registerRequestAttachment, openRequest } from "@/lib/file-actions";
import { inp, lbl } from "@/components/ui";
import { URGENCY_LABELS, URGENCY_OPTIONS } from "@/lib/files";

export async function attachFiles(buildingId: string, requestId: string, files: File[]) {
  const results: string[] = [];
  for (const f of files) {
    try {
      const bad = validateFile(f, REQUEST_FILE_TYPES);
      if (bad) throw new Error(bad);
      const path = await uploadToBucket("request-files", `${buildingId}/${requestId}`, f);
      const fd = new FormData();
      fd.set("request_id", requestId);
      fd.set("path", path);
      fd.set("name", f.name);
      const r = await registerRequestAttachment(null, fd);
      if (!r?.ok) throw new Error(r?.message ?? "שמירה נכשלה");
      results.push(`✔ ${f.name}`);
    } catch (e: any) {
      results.push(`✖ ${f.name}: ${e.message}`);
    }
  }
  return results;
}

export function AttachFilesForm({ buildingId, requestId }: { buildingId: string; requestId: string }) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  async function go() {
    const files = Array.from(ref.current?.files ?? []);
    if (!files.length) return;
    setBusy(true);
    setLog(await attachFiles(buildingId, requestId, files));
    if (ref.current) ref.current.value = "";
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <input ref={ref} aria-label="בחירת קבצים לצירוף" type="file" multiple accept={ACCEPT(REQUEST_FILE_TYPES)} className="block w-full text-sm" disabled={busy} />
      <p className="text-xs text-gray-500">{REQUEST_FILE_HINT}</p>
      <button type="button" onClick={go} disabled={busy} className="btn-primary w-full text-sm py-2.5 min-h-[44px] disabled:opacity-60">
        {busy ? "מעלה..." : "צרף קבצים"}
      </button>
      {log.map((l, i) => (
        <p key={i} className={`text-sm ${l.startsWith("✔") ? "text-green-700" : "text-red-700"}`}>{l}</p>
      ))}
    </div>
  );
}

export function NewRequestForm({ buildingId }: { buildingId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<{ ok: boolean; text: string }[]>([]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const files = Array.from(fileRef.current?.files ?? []);
    const pre = files.map((f) => validateFile(f, REQUEST_FILE_TYPES)).find(Boolean);
    if (pre) return setMsgs([{ ok: false, text: pre }]);
    if (files.length > 10) return setMsgs([{ ok: false, text: "ניתן לצרף עד 10 קבצים" }]);
    setBusy(true);
    setMsgs([]);
    const res = await openRequest(null, new FormData(e.currentTarget));
    if (!res?.ok || !res.id) {
      setMsgs([{ ok: false, text: res?.message ?? "הפתיחה נכשלה" }]);
      setBusy(false);
      return;
    }
    const out = [{ ok: true, text: "הפנייה נפתחה." }];
    if (files.length) for (const l of await attachFiles(buildingId, res.id, files)) out.push({ ok: l.startsWith("✔"), text: l });
    setMsgs(out);
    formRef.current?.reset();
    setBusy(false);
    router.refresh();
  }

  return (
    <form ref={formRef} onSubmit={submit} className="space-y-2 mt-3">
      <input type="text" name="title" aria-label="כותרת" placeholder="כותרת (למשל: נורה שרופה בקומה 2)" className={inp} required />
      <input type="text" name="category" aria-label="קטגוריה" placeholder="קטגוריה (תחזוקה, ניקיון וכו')" className={inp} />
      <div>
        <label className={lbl}>דחיפות</label>
        <select name="urgency" aria-label="דחיפות" className={inp} required defaultValue="">
          <option value="" disabled>בחר/י דחיפות</option>
          {URGENCY_OPTIONS.map((u) => <option key={u} value={u}>{URGENCY_LABELS[u]}</option>)}
        </select>
      </div>
      <textarea name="description" aria-label="תיאור" placeholder="תיאור מפורט" className={inp} rows={2} />
      <div>
        <label className={lbl}>קבצים (אופציונלי)</label>
        <input ref={fileRef} aria-label="בחירת קבצים לצירוף" type="file" multiple accept={ACCEPT(REQUEST_FILE_TYPES)} className="block w-full text-sm" />
        <p className="text-xs text-gray-500 mt-1">{REQUEST_FILE_HINT}</p>
      </div>
      <button type="submit" disabled={busy} className="btn-primary w-full text-sm py-2.5 min-h-[44px] disabled:opacity-60">
        {busy ? "שולח..." : "פתח/י בקשה"}
      </button>
      {msgs.map((m, i) => <p key={i} className={`text-sm ${m.ok ? "text-green-700" : "text-red-700"}`}>{m.text}</p>)}
    </form>
  );
}
