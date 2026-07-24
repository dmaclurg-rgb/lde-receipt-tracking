# Setup

## Local development

```bash
# Node — this repo was built against v24 LTS via nvm:
#   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
#   nvm install --lts

# Python matching service (separate terminal, keep running):
cd ../receipt-recon
python3 -m venv .venv
.venv/bin/pip install fastapi "uvicorn[standard]" pdfplumber python-multipart
.venv/bin/uvicorn service:app --port 8008 --reload

# Web app:
cd web
npm install
cp .env.example .env.local   # generate AUTH_SECRET, see below
npx prisma migrate dev       # creates prisma/dev.db
npx tsx prisma/seed.ts       # seeds Property table + supply catalog
npx tsx scripts/create-user.ts you@example.com "a strong password" "Your Name" --admin
npm run dev
```

Open http://localhost:3000 and sign in with the login you just created.
Google Drive and Notion aren't required to run the app locally: files save
to `web/local-storage/` instead of Google Drive, and Notion sync silently
no-ops (logs to the console instead of throwing) — see
`lib/storage/index.ts` and `lib/notion.ts`.

## Credentials only you can create

None of these can be provisioned by an AI agent — they require your own
Google/Notion/Slack accounts and, for Google Cloud, billing/consent-screen
setup that only an account owner can click through.

### 1. Team logins (admin-assigned, no Google account needed)

There's no OAuth and no self-service signup. Once at least one admin
exists, day-to-day user management happens in the app itself at **/team**
(admin-only — add a teammate, or re-enter an existing email with a new
password to reset it).

The very first admin has to be bootstrapped from the command line, since
nobody can access /team before an admin exists:

```bash
npx tsx scripts/create-user.ts you@luxurydesertescapes.com "a strong password" "Your Name" --admin
```

Run the same command (drop `--admin` for a regular teammate) again against
production once Postgres is set up — it just needs `DATABASE_URL` pointed
at whichever database you want the login created in.

### 2. Google Drive storage (optional until you want real Drive filing)

1. In the same Google Cloud project, enable the **Google Drive API**.
2. Create a **service account**, generate a JSON key for it.
3. Share the target Drive folder (e.g. the existing
   "Vendor Invoices & Receipts - Tax 2026" folder) with the service
   account's email address (looks like
   `something@your-project.iam.gserviceaccount.com`), Editor access.
4. Put the JSON in `.env.local` as `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON`
   (paste the whole thing on one line) or save it to a file and point
   `GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE` at it.
5. Set `GOOGLE_DRIVE_ROOT_FOLDER_ID` to that folder's ID (the long string in
   its Drive URL).

Until this is set, files save under `web/local-storage/` instead — nothing
else breaks.

### 3. Notion ledger (optional until you want the team-browsable ledger)

1. Create an internal integration at https://www.notion.so/my-integrations.
2. Create a database in Notion with these properties: `Name` (title),
   `Date` (date), `Amount` (number), `Property` (select), `Category`
   (select), `Payment Method` (select), `Needs Review` (checkbox), `File`
   (url).
3. Share that database with your integration (••• menu → Connections →
   add your integration).
4. Put the integration token in `.env.local` as `NOTION_TOKEN`, and the
   database ID (from its URL) as `NOTION_DATABASE_ID`.

Until this is set, ledger syncs are logged to the console and skipped —
nothing else breaks.

### 4. Slack ingestion (Phase 2 — the code is built, this is what's left)

The receipt/supply/other/CEO channels feed into the exact same pipeline as
the app's Add Receipt form via `app/api/slack/events/route.ts`. To turn it
on:

1. Go to https://api.slack.com/apps → **Create New App** → From scratch.
   Name it something like "LDE Receipt Bot", pick your workspace.
2. **OAuth & Permissions** → add these Bot Token Scopes:
   - `channels:history` (read messages in the channels it's in)
   - `files:read` (download the receipt photos people post)
   - `chat:write` (post the "✅ Logged to X" confirmation reply)
   - `users:read.email` (optional — attributes receipts to a real email
     instead of a Slack user ID; skip if you'd rather not grant it)
   - `channels:read` (optional — lets the history-backfill search in step 8
     below auto-discover every channel the bot's in, instead of only the
     ones you list in `SLACK_MONITORED_CHANNELS`)
3. Still on **OAuth & Permissions**, click **Install to Workspace**, then
   copy the **Bot User OAuth Token** (`xoxb-...`) into `.env.local` /
   your production env as `SLACK_BOT_TOKEN`.
4. **Basic Information** → copy the **Signing Secret** into
   `SLACK_SIGNING_SECRET`.
5. **Event Subscriptions** → toggle on, Request URL:
   `https://<your-deployed-url>/api/slack/events` (this needs the app
   deployed first — see deployment below; Slack verifies the URL live with
   a real signed request, `http://localhost` won't work here).
   Under "Subscribe to bot events", add `message.channels`.
6. Invite the bot to each channel you want it watching:
   `/invite @LDE Receipt Bot` in the receipt channel, supply channel, other
   channel, and the CEO's channel.
7. In each of those channels, right-click → **View channel details** →
   copy the Channel ID (bottom of the panel), and set
   `SLACK_MONITORED_CHANNELS` to the comma-separated list. Leave it empty
   to watch every channel the bot's been invited to (requires the
   `channels:read` scope from step 2 — without it, leave this empty and the
   history-backfill search below just won't have anything to search until
   you set it explicitly).
8. **Slack Message History search** (on **/email-accounts** in the app,
   alongside Email Accounts) is a second, independent path on top of the
   live webhook above — it backfill-searches channel history for anything
   the live listener missed (messages posted before the bot was added, or
   during any webhook downtime). It reuses the same bot token/channels
   above, runs hourly via Vercel Cron (`web/vercel.json`), and also has a
   **Search Slack Now** button for on-demand runs. Needs `CRON_SECRET` set
   (see the Email Auto-Ingestion section below) for the cron job to authenticate.

Until this is configured, the live webhook route just 401s (bad/missing
signature) and the history search shows "no channels to search" — nothing
else in the app is affected.

### 5. Email auto-ingestion (Phase 3 — scans inboxes for receipts/invoices)

Connects to any of the 5 company inboxes (`drewmaclurg@gmail.com`,
`luxurydesertescapes@gmail.com`, `dmaclurg@luxurydesertescapes.com`,
`reservations@luxurydesertescapes.com`, `invoicelde@gmail.com`) and scans
each hourly for vendor order confirmations/invoices (Amazon, Instacart,
Costco, Home Depot, or subject containing "invoice"/"receipt"), filing each
as a needs-review receipt — see **/email-accounts** and the "Auto-Ingested
Receipts" section on **/review**.

This needs its own Google OAuth client (separate from Drive's service
account) because a service account can't reach personal `@gmail.com`
inboxes the way it can a shared Drive folder — each inbox owner has to
individually grant read-only Gmail access.

1. In Google Cloud Console (same or a new project), go to **APIs & Services
   → Library**, enable the **Gmail API**.
2. **APIs & Services → OAuth consent screen** — if not already configured,
   set it up as **External** (since the personal `@gmail.com` inboxes
   aren't part of the `luxurydesertescapes.com` Workspace), add your own
   email as a **test user** for now (lets you connect inboxes immediately
   without Google's app-verification review, which isn't needed for an
   internal 5-inbox tool).
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**,
   type **Web application**. Under **Authorized redirect URIs**, add:
   `https://ldeoperations.com/api/email-accounts/callback` (and
   `http://localhost:3000/api/email-accounts/callback` too, if you want to
   test connecting an inbox locally).
4. Copy the **Client ID** and **Client Secret** into `.env.local` /
   production env as `GOOGLE_GMAIL_CLIENT_ID` and `GOOGLE_GMAIL_CLIENT_SECRET`.
5. On the deployed app, sign in as an admin, go to **/email-accounts**, and
   click **+ Connect an Inbox** once per inbox — this opens Google's consent
   screen; whoever's logged into that Google account in the browser at that
   moment is the inbox that gets connected (log out/use an incognito window
   between each of the 5 to connect them all from one computer).
6. Set `CRON_SECRET` to any random string (e.g. `openssl rand -hex 32`) in
   the production env — this is what authorizes the hourly Vercel Cron job
   (`web/vercel.json`) to call the sync endpoint without an admin session.

Until `GOOGLE_GMAIL_CLIENT_ID`/`GOOGLE_GMAIL_CLIENT_SECRET` are set,
**/email-accounts** just shows a "not configured yet" notice — nothing else
breaks.

**Note on Vercel's Hobby plan:** the free Hobby tier only allows Cron Jobs
that run once a day — an hourly schedule isn't just throttled, it makes
the *entire deployment fail* (`vercel.json`'s crons are validated at
deploy time). Both jobs in `web/vercel.json` are set to run once daily
(1:00pm and 1:15pm UTC) for this reason. If you upgrade to Pro later, you
can tighten the schedule back to hourly (`0 * * * *`); until then, hitting
**Search Now** on /email-accounts manually is how you get more-than-daily
freshness.

### 6. Forgot-password admin notification (optional until you want it live)

There's no self-service reset (logins are admin-assigned, see #1 above) —
the **Forgot password?** link on `/login` just emails every admin saying
who asked, so an admin can reset it from `/team`. Uses Gmail SMTP:

1. On the Google account you want notifications sent from (e.g. a shared
   `luxurydesertescapes.com` address), turn on **2-Step Verification** if
   it isn't already, at https://myaccount.google.com/security.
2. Create an app password at https://myaccount.google.com/apppasswords
   (name it something like "LDE app SMTP").
3. Put that account's address in `.env.local` as `SMTP_USER`, and the
   16-character app password (no spaces) as `SMTP_PASS`.

Until this is set, reset requests are logged to the console and skipped —
nothing else breaks, and the "Forgot password?" page still shows the same
generic confirmation either way.

## Deployment (Phase 2)

Two independently-deployable pieces:

- **`web/`** (Next.js) → **Vercel** is the path of least resistance for a
  Next.js app: connect the GitHub repo, set the root directory to `web/`,
  and paste in every `.env.local` value as a Vercel environment variable
  (plus `MATCHING_SERVICE_URL` pointed at wherever you deploy the Python
  service below, and a production `DATABASE_URL` — see next section).
- **`receipt-recon/service.py`** (FastAPI) → needs a host that stays
  running (unlike Vercel's serverless functions, which cold-start/sleep —
  fine for the web app, not for this always-on matching service). A
  `Dockerfile` is already in `receipt-recon/`. Render, Fly.io, and Railway
  all support "deploy this Dockerfile" directly from the GitHub repo with a
  free/cheap tier — pick whichever you already have an account with, or
  Render if starting fresh (simplest UI for a single Docker service).
  Note: this Dockerfile hasn't been build-tested in this environment (no
  Docker available on this dev machine) — do a `docker build .` locally
  first if you have Docker, or just deploy and check the host's build logs.

Once both are up, set `MATCHING_SERVICE_URL` on the Vercel deployment to
the FastAPI service's public URL, and use the Vercel deployment's URL as
the Slack Event Subscriptions Request URL above.

## Production database

SQLite (`prisma/dev.db`) is a single file — fine for local dev, not for a
deployed app with concurrent writes. Before deploying:

1. Provision a Postgres database. **Neon** (neon.tech) is a good default —
   serverless Postgres, generous free tier, no credit card required, and
   it plugs into Vercel with one click (Vercel's integrations marketplace
   has a native Neon option that sets `DATABASE_URL` for you).
2. In `prisma/schema.prisma`, change:
   ```
   datasource db {
     provider = "postgresql"   // was "sqlite"
     url      = env("DATABASE_URL")
   }
   ```
3. Delete `prisma/migrations/` and run `npx prisma migrate dev --name init`
   once against the new Postgres `DATABASE_URL` — SQLite and Postgres
   migration SQL aren't interchangeable, so this regenerates a clean,
   Postgres-flavored migration history (this is Prisma's own recommended
   procedure when switching providers, not a workaround).
4. Run `npx tsx prisma/seed.ts` once against production to seed properties.
5. From then on, deploys run `npx prisma migrate deploy` (not `migrate dev`)
   to apply new migrations without prompting.
