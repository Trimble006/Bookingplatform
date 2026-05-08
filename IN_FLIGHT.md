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

- `#billing` — platform subscription model + financial dashboards. Phase A (schema) done; Phase B (API) next. Session: `bp: #billing`. Branch: `feature/billing`.
- `#permission-groups` — C1 (schema + seed) done; C2 (dual gate) next. Session: `bp: #permission-groups`. Branch: `feature/permission-groups`.

<!-- Format:
- `#<tag>` — one-sentence intent. Session: `bp: #<tag>`. Branch: `<name>` (optional).
-->

---

## Just parked


- `#agent-self-supersede` — Step 3c-iv of agent-v2 plan: detector should mark its own stale PENDING proposals as SUPERSEDED on subsequent runs. Plan: `parked-plans/agent-v2-followups.md`. **Pull in before inbox sees production traffic.**
- `#triager-proposals` — Step 3c-v of agent-v2 plan: migrate triager to emit `MAINTENANCE_TASK_ASSIGN` proposals. Plan: `parked-plans/agent-v2-followups.md`.
- `#midge-forecast` — implementation plan complete, blocked on nothing. Plan: `parked-plans/midge-forecast.md`.
- `#multi-slot-booking` — design decided, plan in `DECISIONS.md` 2026-05-03. No parked-plan file.

---

## Recently landed

- 2026-05-08 — `#i18n` string extraction complete (92/101 files, 14 namespaces). Branch: `feature/i18n-completion` (merged). `DECISIONS.md`.
- 2026-05-07 — `#i18n` foundation + locale-aware formatting merged to main. Branch: `feature/i18n` (merged). `DECISIONS.md`.
- 2026-05-05 — `#agents-v2` propose-not-publish loop closed end-to-end. Follow-ups parked at `parked-plans/agent-v2-followups.md`. `DECISIONS.md`.
- 2026-05-05 — TAR wizard improvements (unlock cascade + readiness warnings) merged to main.
- 2026-05-05 — Federation & Permissions full design plan. `DECISIONS.md`.
