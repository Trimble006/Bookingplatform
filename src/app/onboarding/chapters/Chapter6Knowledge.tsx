"use client";

import { useState } from "react";
import { ChapterShell, Field, inputClass } from "./shared";
import type { ChapterProps } from "./shared";

// Friendly prompts that get auto-classified into AgentKnowledge categories.
const PROMPTS = [
  { key: "greens", category: "facility", title: "Anything unusual about your greens?", placeholder: "e.g. East green slopes 4° toward the pond; west green has thin turf in the centre." },
  { key: "pavilion", category: "facility", title: "Any quirks with the pavilion or pump house?", placeholder: "e.g. taps freeze under -3°C; the boiler is older and slow to restart." },
  { key: "events", category: "calendar", title: "Big events coming up the agents should plan around?", placeholder: "e.g. Open day 3rd Saturday in May; County match early June." },
  { key: "rules", category: "policy", title: "What's always urgent — drop everything if this happens?", placeholder: "e.g. Standing water on the green; vandalism; injuries during play." },
  { key: "calm", category: "policy", title: "What is NOT urgent, even if a member reports it?", placeholder: "e.g. Footprints on the green; minor litter; cosmetic flag wear." },
  { key: "local", category: "environment", title: "Anything about local weather, soil, or surroundings the agents should know?", placeholder: "e.g. Coastal: salt-laden wind; clay soil holds water for 2-3 days after rain." },
];

export default function Chapter6Knowledge({ onAdvance }: ChapterProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const update = (key: string, val: string) => setAnswers((s) => ({ ...s, [key]: val }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    for (const p of PROMPTS) {
      const content = answers[p.key]?.trim();
      if (!content) continue;
      await fetch("/api/agent/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: "TENANT",
          category: p.category,
          title: p.title,
          content,
          priority: 5,
          source: "MANUAL",
        }),
      });
    }
    setBusy(false);
    await onAdvance();
  };

  return (
    <ChapterShell
      title="What the agents should know"
      intro="Anything you tell us here helps the maintenance and triage agents make smarter calls. Skip any that don't apply."
      onSubmit={submit}
      busy={busy}
      canSkip
      onSkip={onAdvance}
    >
      {PROMPTS.map((p) => (
        <Field key={p.key} label={p.title}>
          <textarea
            className={inputClass + " min-h-[80px]"}
            placeholder={p.placeholder}
            value={answers[p.key] ?? ""}
            onChange={(e) => update(p.key, e.target.value)}
          />
        </Field>
      ))}
    </ChapterShell>
  );
}
