# Assignment: Project Phoenix — Handover Notes

**Client:** A well-meaning but naive startup that went "all in" on AI-driven development.

**Background:** The client discarded their team's engineering best practices, assuming AI tooling would handle everything from design to testing. The result is a system that *appears* to work, but its quality, reliability, and test coverage are complete unknowns. The client has now realised the "magic" was an illusion and has called in your team of experts to assess the damage and create a recovery plan.

**Your Mission:**

1.  **Onboard & Assess:** Get the application running locally. Your first task is to use the same AI tooling (GitHub Copilot) to guide you through the setup, just as the original developers did. Assess the quality of the codebase and its existing tests as you go.
2.  **Identify & Improve:** Find the "AI-generated" anti-patterns, bugs, and quality gaps. Implement targeted improvements in a controlled, professional manner.
3.  **Report & Recommend:** Produce a report detailing your findings, the improvements you made, and a set of sustainable working practices for the client to adopt going forward.

This document contains the original, sparse handover notes from the client. Use them, but your primary tool for this first phase is the AI assistant itself. See how far you can get with prompts like:
- 'How do I get this project running locally?'
- 'What environment variables do I need?'
- 'How do I set up the database for this project?'

---

## Prerequisites (from client)

The original developers confirmed you will need:

- **Node.js 18+** — verify: `node --version`
- **Git** — verify: `git --version`
- **VS Code** with **GitHub Copilot** extension (licensed)

---

## Pre-workshop Setup (from client)

### 1. Goal: A running PostgreSQL 16 server

Our app needs a Postgres database. Your goal is to have a running server that you can connect to.

#### Step 1.1: Check for an existing installation

Open a terminal and run: `psql --version`

-   **If it returns `psql (PostgreSQL) 16.x`**: Great, you're on the right version. Skip to **Step 1.3**.
-   **If it returns an older version (12.x, 14.x, etc.)**: That's probably fine. The app isn't using any v16-specific features. Skip to **Step 1.3**.
-   **If the command fails**: You need to install Postgres. Continue to **Step 1.2**.

#### Step 1.2: Install PostgreSQL 16 (if needed)

1.  Download the Windows installer from https://www.postgresql.org/download/windows/ (EDB installer).
2.  Run the installer, accepting defaults. **Remember the superuser password** you set.
3.  The installer will also install **pgAdmin** (a GUI) and **psql** (a command-line tool).

#### Step 1.3: Ensure the service is running

-   Check in **Windows Services** that a service named `postgresql-x64-16` (or similar) has status "Running".
-   Alternatively, run `pg_isready` in a terminal. It should return `... - accepting connections`.
-   If it's not running, start it from the Services panel.

#### Step 1.4: Create the app database and user

You now need to create the specific user (`booking`) and database (`bookingplatform`) for the app.

1.  Open a `psql` terminal. If you just installed, you can find it in the Start Menu. You'll connect as the `postgres` superuser.
2.  Run the following commands:

```sql
CREATE USER booking WITH PASSWORD 'booking';
CREATE DATABASE bookingplatform OWNER booking;
```

**Troubleshooting this step:**

-   **`ERROR: role "booking" already exists`**: No problem. Someone's been here before. Move on.
-   **`ERROR: database "bookingplatform" already exists`**: Also fine. If you want a clean slate, you can run `DROP DATABASE bookingplatform;` first, but it's not essential.

### 2. Get a Gemini API key

1. Go to https://aistudio.google.com/
2. Sign in with your Google account and accept terms
3. Click **Get API key** → **Create API key**
4. Copy and save the key — you'll need it on the day

> The key is active immediately. Free tier (15 requests/minute) is sufficient.

### 3. Fork and clone the repo

1. Navigate to the repo: https://github.com/Trimble006/Bookingplatform
2. Click **Fork** → create under your own GitHub account
3. Clone your fork locally:

```bash
git clone https://github.com/<your-username>/Bookingplatform.git
cd BookingPlatform
```

---

## On the Day

### Step 1: Install dependencies

```bash
npm install
```

### Step 2: Create your `.env` file

Copy the example file:

```bash
copy .env.example .env
```

Open `.env` in VS Code and set the following values.

| Variable | Value |
|---|---|
| `DATABASE_URL` | `postgresql://booking:booking@localhost:5432/bookingplatform` |
| `NEXTAUTH_URL` | `http://localhost:3000` |
| `NEXTAUTH_SECRET` | *(generate — see below)* |
| `AGENT_LLM_PROVIDER` | `gemini` |
| `AGENT_GEMINI_API_KEY` | *(your key from pre-work step 2)* |
| `AGENT_GEMINI_MODEL` | `gemini-1.5-flash` |
| `AGENT_SECRET` | *(provided by facilitator)* |

**Note on `AGENT_OWM_API_KEY`**: Leave this blank. The client noted the weather integration for the agent is "unreliable" and they disabled it. This is your first clue.

**Generate NEXTAUTH_SECRET** — run this in your terminal:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Paste the output as the value.

### Step 3: Run database migrations

```bash
npx prisma migrate deploy
```

### Step 4: Seed the database

```bash
npm run db:seed
```

### Step 5: Start the dev server

```bash
npm run dev
```

### Step 6: Verify

1. Open http://localhost:3000
2. Log in with `admin@lakeview.club` / `club123`
3. Confirm the dashboard loads

---

## Demo Accounts (seeded)

| Email | Password | Role |
|---|---|---|
| `admin@wlbooking.com` | `admin123` | Platform admin |
| `admin@lakeview.club` | `club123` | Tenant admin |
| `user@lakeview.club` | `user123` | Regular user |
| `maint@lakeview.club` | `user123` | Maintenance user |

---

## Troubleshooting

### "Cannot connect to database"

- Check Postgres is running: **Windows Services** → `postgresql-x64-16` should show "Running"
- If stopped, right-click → Start

### Prisma migrate fails with SSL error

- Ensure your `DATABASE_URL` does **not** have `?sslmode=require` at the end
- Local connections don't need SSL

### Port 5432 already in use

- Another Postgres instance may be running, or a previous install wasn't removed
- Check: `netstat -ano | findstr :5432`

### "Permission denied" creating the database

- Re-run the `CREATE USER` / `CREATE DATABASE` commands as the `postgres` superuser

### Gemini returns 429 (rate limited)

- Free tier allows 15 requests per minute
- Wait a few seconds and retry

### `npm run dev` fails on Windows

- If you see an error about `lsof`, ignore it — that's the `restart` script (Unix only)
- `npm run dev` itself is cross-platform and should work fine
