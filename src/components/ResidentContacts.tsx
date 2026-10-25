"use client";

import { useRef, useState } from "react";
import { getResidentContact, type ContactResult } from "@/lib/contact-actions";
import { parsePhones } from "@/lib/phones";

export type Person = { id: string; name: string; suffix?: string };

// Names are buttons; pressing one reveals that person's contact details (name, phone, email only).
export default function ResidentContacts({ people }: { people: Person[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [cache, setCache] = useState<Record<string, ContactResult>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  async function toggle(id: string) {
    if (openId === id) return setOpenId(null);
    setOpenId(id);
    if (!cache[id]) {
      setLoading(id);
      const r = await getResidentContact(id);
      setCache((c) => ({ ...c, [id]: r }));
      setLoading(null);
    }
  }

  const open = people.find((p) => p.id === openId);
  const data = openId ? cache[openId] : undefined;

  return (
    <span
      className="contents"
      onKeyDown={(e) => {
        if (e.key === "Escape" && openId) { const id = openId; setOpenId(null); btnRefs.current[id]?.focus(); }
      }}
    >
      <span className="inline-flex flex-wrap items-center gap-x-1">
        {people.map((p, i) => (
          <span key={p.id} className="inline-flex items-center">
            <button
              type="button"
              ref={(el) => { btnRefs.current[p.id] = el; }}
              onClick={() => toggle(p.id)}
              aria-expanded={openId === p.id}
              aria-controls={`contact-${p.id}`}
              className="inline-flex items-center min-h-[44px] px-1 rounded text-brand-700 underline decoration-dotted underline-offset-4"
            >
              {p.name}{p.suffix ?? ""}
            </button>
            {i < people.length - 1 && <span aria-hidden="true">,</span>}
          </span>
        ))}
      </span>
      {open && (
        <div
          id={`contact-${open.id}`}
          role="region"
          aria-label={`פרטי קשר: ${open.name}`}
          className="mt-1 mb-1 rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-gray-800 space-y-2"
        >
          {loading === open.id || !data ? (
            <p>טוען פרטי קשר…</p>
          ) : !data.ok ? (
            <p className="text-red-700">{data.message}</p>
          ) : (
            <>
              <div className="font-bold">{data.full_name}</div>
              <PhoneList phone={data.phone} />
              {data.email && (
                <div>
                  <a href={`mailto:${data.email}`} dir="ltr" className="inline-flex items-center min-h-[44px] text-brand-700 underline break-all">
                    {data.email}
                  </a>
                </div>
              )}
              <button
                type="button"
                onClick={() => { setOpenId(null); btnRefs.current[open.id]?.focus(); }}
                className="inline-flex items-center min-h-[44px] px-3 rounded-xl border border-brand-600 text-brand-700 text-sm font-semibold"
              >
                סגירה
              </button>
            </>
          )}
        </div>
      )}
    </span>
  );
}

// One row and one dial button per number; each tel: link holds only its own number.
export function PhoneList({ phone }: { phone: string | null }) {
  const parsed = parsePhones(phone);
  if (parsed.kind === "empty") return <div className="text-gray-700">לא הוזן טלפון</div>;
  if (parsed.kind === "raw") {
    return (
      <div className="space-y-1">
        <div className="font-semibold whitespace-pre-line">{parsed.text}</div>
        <div className="text-xs text-gray-600">לא ניתן לזהות את המספרים בוודאות, ולכן אין כפתור חיוג.</div>
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {parsed.items.map((it, i) => (
        <li key={`${it.dial}-${i}`} className="flex items-center gap-3 flex-wrap">
          {it.label && <span className="text-gray-700">{it.label}</span>}
          <span dir="ltr" className="font-semibold tabular-nums">{it.display}</span>
          <a
            href={`tel:${it.dial}`}
            aria-label={`חיוג ל-${it.display}${it.label ? ` (${it.label})` : ""}`}
            className="inline-flex items-center justify-center min-h-[44px] px-4 rounded-xl bg-brand-600 text-white font-semibold"
          >
            📞 חיוג
          </a>
        </li>
      ))}
    </ul>
  );
}
