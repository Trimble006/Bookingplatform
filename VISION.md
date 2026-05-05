# Vision — BookingPlatform

A **multi-tenant SaaS platform for bowling clubs worldwide**. Clubs pay the
platform for hosting; in return they get:

- A white-labelled public website (branding, content, events)
- A booking system (greens, rinks, slots, payments)
- Member-facing tools (chat, notifications, live streaming)
- Back-office tools (maintenance, admin, audit, analytics)
- Per-club opt-in/out of optional features

## Future ambitions

- **Federations** — a member of club A can act as a member of club B
  (cross-club booking with configurable billing, clash warnings, peer
  agreements). Full design plan at `parked-plans/permission-groups.md`.
- **Cross-club event sharing** (already partially built via
  `eventsShareExternal`)
- Globally distributed clubs with local config (locale, timezone, season
  dates)

## Operating model

**Platform-admin-runs-the-shop**: a small platform team onboards clubs,
handles billing, and configures the platform; each club then self-manages
within the boundaries set by its feature flags and subscription.

## North star

Any bowling club in the world can sign up, self-onboard through a guided
wizard, and be running their bookings + member comms + public website
within a single session — with ongoing AI-powered guidance keeping their
site healthy and their admin load low.
