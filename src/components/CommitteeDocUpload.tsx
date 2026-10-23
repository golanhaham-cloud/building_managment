"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ACCEPT, COMMITTEE_DOC_HINT, COMMITTEE_DOC_TYPES, validateFile } from "@/lib/files";
import { uploadToBucket } from "@/lib/upload";
import { registerCommitteeDocument } from "@/lib/file-actions";
import { inp, lbl } from "@/components/ui";

export default function CommitteeDocUpload({ buildingId }: { buildingId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const f = fileRef.current?.files?.[0];
    if (!f) return setMsg({ ok: false, text: "יש לבחור קובץ" });
    const bad = validateFile(f, COMMITTEE_DOC_TYPES);
    if (bad) return setMsg({ ok: false, text: bad });
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setMsg(null);
    try {
      const path = await uploadToBucket("committee-docs", buildingId, f);
      const fd = new FormData();
      fd.set("title", String(form.get("title") ?? ""));
      fd.set("date", String(form.get("date") ?? ""));
      fd.set("path", path);
      fd.set("name", f.name);
      const r = await registerCommitteeDocument(null, fd);
      if (!r?.ok) throw new Error(r?.message ?? "שמירה נכשלה");
      setMsg({ ok: true, text: r.message });
      formRef.current?.reset();
      router.refresh();
    } catch (err: any) {
      setMsg({ ok: false, text: err.message });
    }
    setBusy(false);
  }

  return (
    <form ref={formRef} onSubmit={submit} className="space-y-2 mt-3">
      <div><label className={lbl}>כותרת</label><input name="title" aria-label="כותרת" className={inp} required /></div>
      <div><label className={lbl}>תאריך המסמך</label><input type="date" aria-label="תאריך המסמך" name="date" defaultValue={new Date().toISOString().slice(0, 10)} className={inp} required /></div>
      <div>
        <label className={lbl}>קובץ</label>
        <input ref={fileRef} aria-label="קובץ" type="file" accept={ACCEPT(COMMITTEE_DOC_TYPES)} className="block w-full text-sm" required />
        <p className="text-xs text-gray-500 mt-1">{COMMITTEE_DOC_HINT}</p>
      </div>
      <button type="submit" aria-disabled={busy || undefined} aria-busy={busy || undefined} className="btn-primary w-full text-sm py-2.5 min-h-[44px] aria-disabled:opacity-60 aria-disabled:cursor-wait">{busy ? "מעלה..." : "העלה לארכיון"}</button>
      {msg && <p className={`text-sm ${msg.ok ? "text-green-700" : "text-red-700"}`} role={msg.ok ? "status" : "alert"}>{msg.text}</p>}
    </form>
  );
}
