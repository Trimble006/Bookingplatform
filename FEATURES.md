
# Club Management Platform — Feature Summary

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
- **Waiting list** — users join waitlist for fully-booked slots; on cancellation the **first waiter** is auto-assigned the slot and notified; remaining waiters are unaffected
- **Season enforcement** — configurable season start/end dates (inclusive on both boundaries); bookings on the first and last day of season are accepted; opening hours apply within-season only
- **Cancellation policy** — users may cancel their own bookings up to **48 hours** before the booking date; within the window only admins can cancel
- **Admin override** — tenant admins can force-book conflicting slots with a mandatory reason (max 500 chars); override reason is displayed to conflicted parties via notification

## Payments
- **Pluggable payment engine** (`lib/payment.ts`) — `PaymentEngine` interface with `createCheckout()` and `refund()`
- **Configurable stub** — `setNextCheckoutOutcome()` / `setNextRefundOutcome()` for testing decline, insufficient funds, expired card, network errors
- **Booking payment flow** — admin confirms → checkout created → redirect to success → refund on cancel
- **Webhook receiver** — `/api/bookings/webhook` accepts payment provider callbacks with ECDSA P-256 signature verification, 5-minute replay window, and full idempotency (duplicate events are safely ignored)
- **Tenant-configurable pricing** — each tenant sets their own per-slot booking fee in their settings; default is £10 per rink slot
- **Platform billing** — `TenantPayment` model for tenant invoicing (pending/paid/failed/refunded)

## Feature Flags
- **Per-tenant runtime toggles** 
- **Platform admin UI** 


## Live Streaming
- **WebRTC broadcasting** admin/maintenance capture camera per rink (browser getUserMedia + RTMP ingest support)
- **Viewer page** peer-to-peer video via signaling API (poll-based ICE/SDP exchange)
- **Feature-gated** — entire streaming stack gated behind `liveStreaming` flag (server + client + nav)
- **Tiered subscriptions** — BRONZE (1 stream, £20/mo), SILVER (3 streams + 7-day archive, £50/mo), GOLD (unlimited + 30-day archive, £100/mo)
- **Stream visibility** — MEMBERS_ONLY or PUBLIC per stream; members-only enforces tenant membership or shareable token links
- **Token-based sharing** — admins generate time-limited, use-limited tokens for private stream access
- **Viewer metrics** — per-stream viewer join/leave tracking, watch duration, unique viewers, device breakdown via TrackingEvent
- **Aggregate metrics** — total streams, live count, total watch-hours, current/peak concurrent viewers
- **Notifications** — STREAM_LIVE notification to all club members on go-live + SSE real-time push
- **Stream lifecycle** — IDLE → LIVE → ENDED → ARCHIVED with concurrent limit enforcement per tier
- **Public discovery** — `/[slug]/streams` lists live PUBLIC streams; `/[slug]/watch/[id]` viewer page
- **Admin dashboard** — `/dashboard/streaming` with create, go-live, stop, metrics, token management
- **Audit trail** — streaming.created, streaming.started, streaming.stopped, streaming.deleted, streaming.token_created, streaming.token_revoked, streaming.tier_changed

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
- **Channels** — public, private, group, and direct message channels per tenant
- **Real-time messages** — user-to-user and group messaging with SSE push to connected clients
- **Strict tenant isolation** — all message operations (read and write) enforce tenant boundary checks; knowing a channel ID from another tenant yields 404
- **Admin channel management** — tenant admins can create, rename, and delete channels
- **Rate limiting** — message sending is rate-limited to 5 messages per 10 seconds per user to prevent spam

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

## Feature Tracking (Observability)
- **TrackingEvent model** — captures page views, feature usage, interactions, and session starts with browser/device/PWA metadata
- **Anonymous + authenticated** — tracks all visitors; anonymous users get a privacy-safe daily-rotating SHA-256 fingerprint (no PII stored)
- **Server-side UA parsing** — lightweight regex-based browser/OS/device detection from `User-Agent` header (no external dependencies, prevents client spoofing)
- **PWA detection** — identifies users on installed PWA vs browser via `display-mode: standalone` and `navigator.standalone`
- **Batched event ingestion** — client queues events, flushes every 5s or on page visibility change; uses `navigator.sendBeacon()` on unload for reliability
- **Rate-limited POST endpoint** — `/api/tracking` accepts up to 50 events per request, IP-based throttle (10 req/10s)
- **Aggregated stats API** — `/api/tracking/stats` returns grouped counts (by browser, device, path, event type, PWA status) over configurable periods (7d/30d/90d)
- **Analytics dashboard** — `/dashboard/analytics` with summary cards, daily traffic bar chart, browser/device breakdown, PWA vs browser split, top pages, feature usage ranking, top interactions
- **Role-scoped access** — tenant admins see own tenant data; platform admins see cross-tenant with tenant filter
- **Feature-gated** — dashboard visibility gated behind `analytics` feature flag per tenant; tracking itself is always on for platform-level insights
- **TrackingProvider + useTrack()** — React context provider auto-tracks page views on route changes, exposes `trackFeature()` and `trackAction()` hooks
- **Instrumented features** — booking grid, events dashboard, maintenance dashboard, messaging all emit `FEATURE_USE` events; booking create/status changes emit `INTERACTION` events
- **Fire-and-forget pattern** — tracking writes are non-blocking; failures never impact user operations

## Platform Admin (Superadmin)
- **Tenant CRUD** — create clubs with branding, greens, admin user, locale
- **Activate/deactivate** tenants on the fly
- **Feature flag toggles** per tenant
- **Platform payments overview**

## Testing
- **24 chat agent unit tests** — all keyword categories, priority ordering, edge cases
- **14 payment stub tests** — success, decline, insufficient funds, expired, network error, auto-reset
- **Webhook integration tests** — signature verification, replay rejection, idempotency, all event types
- **Cross-tenant isolation suite** — dedicated tests verifying every API endpoint respects tenant boundaries
- **Concurrent e2e agents** — 4 Playwright agents (user, admin, maintenance, platform) running in parallel, reacting to each other through the app's UI
- **Exploratory bot** — 6 personas (Doris, Kevin, Mallory, Sandra, Craig, Ghost) with prioritised defect report output

## Charity Accounts (UK/NI only)
- **Two-axis gate** — only available when `Tenant.country ∈ {GB, NI}` AND the `charity` feature flag is enabled. Both required. Country is set by the tenant admin in onboarding (Chapter 2); platform admin can override. Charity flag is auto-enabled by onboarding when the tenant picks a charity-style organisation type (REGISTERED_CHARITY / CIO / SCIO / CASC) in a supported jurisdiction.
- **Auto-enable on charity-style org types** — Chapter 2 picks REGISTERED_CHARITY/CIO/SCIO/CASC in GB/NI → flag enabled, CharitySettings created with regulator inferred (NI→CCNI, SCIO→OSCR, otherwise CC_EW), chart of accounts seeded. Idempotent. Disabling stays explicit (platform-admin action).
- **Settings** — charity number, regulator (`CC_EW` / `OSCR` / `CCNI`), financial year-end (month/day, *inherits from `Tenant.financialYearEnd*` if not overridden*), reserves policy, public benefit statement
- **Auto-seeded chart of accounts** — on first save, seeds 10 receipt categories + 15 payment categories tuned for bowling clubs (subscriptions, green fees, bar income, grounds maintenance, affiliation fees, etc.) plus a default General unrestricted fund
- **Funds** — `UNRESTRICTED` / `RESTRICTED` / `DESIGNATED` per Charity Commission categories
- **Financial years** — overlap-detected, lockable; locked years reject all transaction writes
- **Ledger** — receipt/payment transactions in integer pence, dated, categorised, fund-tagged, optional reference
- **Reports** — Receipts & Payments matrix (categories × funds with totals + net), Statement of Assets & Liabilities (asset/liability lines + bank balance at year end), CSV export of R&P table for attachment to the regulator's annual return
- **Audit** — `charity.settings.created/updated`, `charity.year.created/updated/locked`, `charity.transaction.created/updated/deleted`, `charity.report.viewed/exported`, `tenant.organisation.set` (onboarding KYC + side-effect summary)
- **API surface** — `/api/charity/{settings,years,categories,funds,transactions,asset-liabilities,reports,status}` plus `/api/onboarding/organisation` (KYC entry point); all gated to TENANT_ADMIN with the two-axis check
- **Future** (separate branches): OCR receipt capture (Gemini Vision), Open Banking ingestion (GoCardless stub), TAR/SoFA wizard for charities ≥ £500k

## Onboarding KYC (Chapter 2)
- **Self-declared organisation profile** — Chapter 2 of the 10-chapter wizard captures country (`GB` / `NI` / `OTHER`), organisation type (10-value enum: REGISTERED_CHARITY, CIO, SCIO, CASC, COMMUNITY_INTEREST_COMPANY, LIMITED_COMPANY, UNINCORPORATED_ASSOCIATION, PRIVATE_MEMBERS_CLUB, OTHER, NOT_CONSTITUTED), and financial year end (month + day with day-cap-by-month).
- **Tailored advice** — live `<Advice>` callout with 4 visual variants: NOT_CONSTITUTED (loud amber, links to a path-to-constituted help article); willEnableCharity (emerald, "we'll set up charity accounting"); UNINCORPORATED_ASSOCIATION (amber, mild); default (slate, brief). Each org type also has a per-form help article under `content/help/en/getting-started/legal-form-*.md`.
- **Side-effects** — charity-style org in GB/NI auto-flips the `charity` flag, creates CharitySettings, seeds chart of accounts (see Charity Accounts section above).
- **In-progress migration** — `OnboardingProgress.schemaVersion` (default 2; backfilled to 1 for existing rows). GET shifts entries ≥ 2 up by 1 once and bumps the version. Idempotent. Existing tenants mid-onboarding under the 9-chapter shape land back where they conceptually were.

## Help Centre
- **In-dashboard help** — `/dashboard/help` browse-by-category index, full-text client-side search, article view with breadcrumb
- **Audience-aware** — articles declare `audience: tenant_admin | platform_admin | both`; tenant admins never see platform-only articles
- **Role-gated callouts** — markdown supports `:::platform-admin … :::` and `:::tenant-admin … :::` container directives, rendered as styled callouts only to the matching real role
- **Hybrid content** — shipped markdown defaults under `content/help/{locale}/{category}/{slug}.md` plus optional per-tenant `HelpArticleOverride` rows that replace title/body or hide the article entirely
- **Locale fallback** — requested locale → `en`; UI flags articles served via fallback with a "translation pending" badge
- **Contextual `HelpHint`** — small inline `?` icon component that deep-links to a help article from any dashboard heading; placed on bookings, greens, users, content and notifications pages
- **Override editor** — `/dashboard/help/manage` lets tenant admins customise or hide individual articles, gated behind the `helpOverrides` feature flag
- **Audit + tracking** — override mutations log `help.override.upserted` / `help.override.deleted`; article views fire `FEATURE_USE help.article.view`, hint clicks fire `INTERACTION help.hint.click`, search fires `INTERACTION help.search`
- **API surface** — `GET /api/help`, `GET /api/help/[slug]`, `GET /api/help/shipped`, `GET|POST|DELETE /api/help/overrides`; all gated to TENANT_ADMIN effective role or PLATFORM_ADMIN
