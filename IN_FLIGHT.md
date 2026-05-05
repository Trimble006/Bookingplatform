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

_(none currently — sessions idle as of 2026-05-05)_

<!-- Format:
- `#<tag>` — one-sentence intent. Session: `bp: #<tag>`. Branch: `<name>` (optional).
-->

---

## Just parked

- `#permission-groups` — federation + permission groups full design done. Plan: `parked-plans/permission-groups.md`. Branch: `feature/permission-groups`.
- `#midge-forecast` — implementation plan complete, blocked on nothing. Plan: `parked-plans/midge-forecast.md`.
- `#multi-slot-booking` — design decided, plan in `DECISIONS.md` 2026-05-03. No parked-plan file.

---

## Recently landed

- 2026-05-05 — TAR wizard improvements (unlock cascade + readiness warnings) merged to main. Branches deleted.
- 2026-05-05 — Federation & Permissions full design plan. `DECISIONS.md`.
- 2026-05-04 — Onboarding KYC Chapter 2 (country + org type + FY end). `DECISIONS.md`.
- 2026-05-04 — Charity Accounts MVP shipped (P0+P1+P2). `DECISIONS.md`.
- 2026-05-03 — TAR Wizard: guided Trustees' Annual Report. `DECISIONS.md`.
