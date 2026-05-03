"use client";

import { useEffect, useState } from "react";
import { ChapterShell, Field, inputClass } from "./shared";
import type { ChapterProps } from "./shared";

export default function Chapter3Hours({ tenantId, onAdvance }: ChapterProps) {
  const [openingTime, setOpeningTime] = useState("08:00");
  const [closingTime, setClosingTime] = useState("20:00");
  const [seasonStart, setSeasonStart] = useState("");
  const [seasonEnd, setSeasonEnd] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    fetch(`/api/admin/tenants/${tenantId}`)
      .then((r) => r.json())
      .then((t) => {
        setOpeningTime(t.openingTime ?? "08:00");
        setClosingTime(t.closingTime ?? "20:00");
        setSeasonStart(t.seasonStart ?? "");
        setSeasonEnd(t.seasonEnd ?? "");
        setLoaded(true);
      });
  }, [tenantId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;
    setBusy(true);
    await fetch(`/api/admin/tenants/${tenantId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        openingTime,
        closingTime,
        seasonStart: seasonStart || null,
        seasonEnd: seasonEnd || null,
      }),
    });
    setBusy(false);
    await onAdvance();
  };

  if (!loaded) return <div className="text-gray-500">Loading…</div>;

  return (
    <ChapterShell
      title="When you're open"
      intro="The hours members can book within, and the dates of the playing season."
      onSubmit={submit}
      busy={busy}
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Opens at">
          <input type="time" className={inputClass} value={openingTime} onChange={(e) => setOpeningTime(e.target.value)} />
        </Field>
        <Field label="Closes at">
          <input type="time" className={inputClass} value={closingTime} onChange={(e) => setClosingTime(e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Season starts" hint="Leave blank for year-round.">
          <input type="date" className={inputClass} value={seasonStart} onChange={(e) => setSeasonStart(e.target.value)} />
        </Field>
        <Field label="Season ends">
          <input type="date" className={inputClass} value={seasonEnd} onChange={(e) => setSeasonEnd(e.target.value)} />
        </Field>
      </div>
    </ChapterShell>
  );
}
