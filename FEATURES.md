
# WL Booking — Feature Summary

## Platform overview
 - Platform to provide websites for bowling clubs across the globe.  Platform will obtain fees from clubs for the hosting and offer a wide range of features.  Clubs will have their own admins and ability to opt in/out of some features. At some future point, we will support the idea of 'federations', where members of a club can behave a thou hthey are members of a second club. Clubs will be able to configure their site to their own design via content management service within the platform and tailor fees/events/openng times. Clubs will be bale to advertise events on the website, and optionally make these visible to the public.  Similarly, clubs can opt in/out of disaplying events from other clubs on their website.


## Core Platform
- **Multi-tenant SaaS** — white-label bowling club platform with per-tenant branding, config, and data isolation
- **Tenant resolution** 
- **Role-based access** — `user`, `maintenance`, `tenant admin`, `platform admin`, `guest`
- **Neutral public landing** — anonymous users on `/` see platform-level neutral content with no tenant branding
- **Tenant experience after login** — authenticated users on `/` see their tenant-specific branding and content

## Booking System
- **Availability grid** — date picker → green/rink grid showing open/booked slots
- **Multi-green support** — each tenant configures N greens with M rinks each
- **Booking workflow** — `requested → approved → reserved → confirmed → cancelled/refunded`
- **Player fields** — per-rink player name capture
- **Waiting list** — users join waitlist for fully-booked slots, notified on cancellation
- **Season enforcement** — configurable season start/end dates, opening hours

## Payments
- **Pluggable payment engine** (`lib/payment.ts`) — `PaymentEngine` interface with `createCheckout()` and `refund()`
- **Configurable stub** — `setNextCheckoutOutcome()` / `setNextRefundOutcome()` for testing decline, insufficient funds, expired card, network errors
- **Booking payment flow** — admin confirms → checkout created → redirect to success → refund on cancel
- **Platform billing** — `TenantPayment` model for tenant invoicing (pending/paid/failed/refunded)

## Feature Flags
- **Per-tenant runtime toggles** 
- **Platform admin UI** 


## Live Streaming
- **WebRTC broadcasting** admin/maintenance capture camera per rink
- **Viewer page**  peer-to-peer video via signaling API
- **Feature-gated** — entire streaming stack gated behind `liveStreaming` flag (server + client + nav)

## Chat Agent
- **ChatMessage model** stores messages with evaluation metadata
- **Evaluation engine**  — 8 keyword pattern categories ranked by severity
- **Auto task creation** — safety/facility/equipment/grounds/suggestion messages → maintenance tasks
- **Admin review dashboard**  — stats cards, category breakdown, filter tabs, mark-reviewed workflow

## Task Agent (Automation)
- **Rule engine**  — evaluates conditions against tasks, executes actions
- **Actions**: `auto_assign`, `escalate_priority`, `notify`, `add_note`, `close_stale`
- **Admin workflows UI**  — rule builder, activity log, stats, manual run

## Maintenance Module
- **Task management** — submit, assign, start, close, reopen with timestamped notes
- **7 categories** — general, rink surface, equipment, facilities, safety, grounds, other
- **Priority levels** — low, medium, high, urgent
- **Role-scoped views** — maintenance sees own tasks, admin sees all

## Messaging
- **Channels** — public, private, and group channels per tenant
- **Real-time messages** — user-to-user and group messaging
- **Admin channel management** 

## Content Management
- **Headless CMS** — landing page sections with draft → review → published → archived workflow
- **Section types** — hero, about, photo, map, contact with conditional fields
- **Toggle visibility** — enable/disable individual content blocks

## Events & Weather
- **Structured events** — full Event model with title, description, date/time, category, format, player count, capacity, entry fee, contact info, image URL
- **Event categories** — social, competition, league, open day, tournament, other
- **Tournament details** — optional format (knockout, American, league, Canadian) and player count (singles, pairs, triples, fours)
- **Draft → Published workflow** — simple two-state lifecycle with publish/unpublish transitions
- **Visibility control** — events can be members-only or public; public events visible to unauthenticated visitors
- **Cross-tenant event sharing** — automatic opt-in via `eventsShareExternal` (outbound) and `eventsShowExternal` (inbound) feature flags
- **Public landing page display** — upcoming published events shown on tenant homepage with EventCard grid
- **Dashboard management** — full CRUD with category/format/player-count fields, status transitions, external events tab
- **Feature-gated** — entire events stack gated behind `events` flag (API + dashboard nav + landing page)
- **Audit trail** — `event.created`, `event.updated`, `event.published`, `event.unpublished`, `event.deleted` actions logged
- **Weather integration**  — forecast display on booking page tied to venue lat/lng

## Progressive Web App
- **Installable PWA** — manifest, service worker, offline page, install prompt
- **Icons** — 192px and 512px SVG icons with maskable variant

## Internationalisation
- **4 locales** — English, Welsh (Cymraeg), French, Scottish Gaelic
- **`useTranslation()` hook** — reads tenant locale from context

## Authentication
- **NextAuth v4** with credentials provider
- **Password reset** — token-based forgot/reset flow
- **Registration** with email/password

## Audit Trail
- **AuditEvent model** — every significant action logged with actor, role snapshot, tenant, entity, timestamp, and freeform `meta` JSON
- **PII access tracking** — explicit `piiAccess` flag on events where personal data was surfaced (user lists, player names, user detail views)
- **Role-scoped visibility** — users see own history, tenant admins see all tenant activity, platform admins see everything
- **Dot-notation action vocabulary** — `auth.*`, `booking.*`, `task.*`, `payment.*`, `admin.*`, `pii.*`
- **Full instrumentation** — all API routes (bookings, auth, maintenance, admin, payments) emit audit events on mutations and PII access
- **Standalone dashboard** — `/dashboard/audit` with filters (action domain, date range, PII-only, entity search) and pagination
- **Fire-and-forget logging** — audit writes are non-blocking; failures never impact user operations

## Platform Admin (Superadmin)
- **Tenant CRUD** — create clubs with branding, greens, admin user, locale
- **Activate/deactivate** tenants on the fly
- **Feature flag toggles** per tenant
- **Platform payments overview**

## Testing
- **24 chat agent unit tests** — all keyword categories, priority ordering, edge cases
- **14 payment stub tests** — success, decline, insufficient funds, expired, network error, auto-reset
- **Concurrent e2e agents** — 4 Playwright agents (user, admin, maintenance, platform) running in parallel, reacting to each other through the app's UI
- **Exploratory bot** — 6 personas (Doris, Kevin, Mallory, Sandra, Craig, Ghost) with prioritised defect report output
