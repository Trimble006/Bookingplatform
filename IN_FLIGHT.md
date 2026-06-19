# In flight — BookingPlatform

What's open right now, across chat sessions. Read this at the start of any
non-trivial task — if a topic already has an active or parked thread, resume
the existing session (or branch off deliberately) rather than starting from
scratch.

**Conventions**:
- One `#tag` per topic. Tags thread through `ROADMAP.md`, `DECISIONS.md`,
  `parked-plans/<tag>.md`, and `/memories/repo/open-questions.md`. Grep one
  tag to see its full lifecycle.
- "Recently landed" caps at the last ~5 entries; older shipped work lives
  in `DECISIONS.md`.
- "Just parked" is a one-line pointer; the *why* lives in
  `/memories/repo/open-questions.md`, the *how* (refined plan) lives in
  `parked-plans/<tag>.md` if one exists.
- When ye start a new chat session for a topic, rename the session to
  `bp: #<tag>` so it lines up with this ledger.

---

## Active threads

- `#modular-services` — multi-vertical capability-modular platform: Vertical enum, bookings flag, adaptive wizard, cap-gated nav, Charity Admin plan, branding. Phases 0–4 implementing. Session: `bp: #modular-services`.
- `#billing` — platform subscription model + financial dashboards. Phase A (schema) done; Phase B (API) next. Session: `bp: #billing`.

<!-- Format:
- `#<tag>` — one-sentence intent. Session: `bp: #<tag>`. Branch: `<name>` (optional).

- `#billing` — platform subscription model + financial dashboards. Phase A (schema) done; Phase B (API) next. Session: `bp: #billing`.



- `#agent-self-supersede` — Step 3c-iv of agent-v2 plan: detector should mark its own stale PENDING proposals as SUPERSEDED on subsequent runs. Plan: `parked-plans/agent-v2-followups.md`. **Pull in before inbox sees production traffic.**
- `#midge-forecast` — implementation plan complete, blocked on nothing. Plan: `parked-plans/midge-forecast.md`.
- `#multi-slot-booking` — design decided, plan in `DECISIONS.md` 2026-05-03. No parked-plan file.

---

## Recently landed

- 2026-06-18 — `#modelops` fully shipped (extends `#ml-noshow`): prediction persistence root fix, MlModelVersion/MlFeatureDefinition/MlDriftCheck schema, champion/challenger retrain gate, drift check, feature registry (enroll/retire), model-health dashboard, operator runbook. Bug #15 resolved. See `DECISIONS.md`.
- 2026-06-17 — `#ml-noshow` Phases 0–4 shipped: Python sidecar, NoShowRiskAgent, eval script, 26 pytest + 8 jest. See `DECISIONS.md`.
- 2026-06-16 — `#business-insights` fully shipped: 9-domain KPI platform admin dashboard + tenant analytics phases A–C. All branches merged + deleted.
- 2026-06-16 — `#charity-permissions` shipped via `feat/charity-permissions-20260518162137`: bookings/funding route gates tenant-scoped to the `Permission` enum; per-response AI refine endpoint + shared `funding/ai.ts`; multi-round funding (status-aware overview, advisory cadence, `FundingOpportunityPref`). 523 tests. `DECISIONS.md`.
- 2026-05-10 — `#funding-applications` all 3 phases shipped: schema/CRUD/UI, eligibility scoring + 9 seeded UK grants, AI-assisted drafting via FundingApplicationAgent. Branch: `feat/funding-applications`. `DECISIONS.md`.
- 2026-05-09 — `#permission-groups` full 6-phase feature (C1–C6) merged: permission groups, federation lifecycle, cross-club booking, federation UI. 476 tests. `DECISIONS.md`.
- 2026-05-08 — `#i18n` string extraction complete (92/101 files, 14 namespaces). Branch: `feature/i18n-completion` (merged). `DECISIONS.md`.
