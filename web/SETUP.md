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
npx tsx scripts/create-user.ts you@example.com "a strong password" "Your Name"
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

There's no OAuth and no self-service signup — you create each teammate's
login directly:

```bash
npx tsx scripts/create-user.ts drew@luxurydesertescapes.com "a strong password" "Drew"
npx tsx scripts/create-user.ts july@luxurydesertescapes.com "a different password" "July"
```

Run it again with the same email to change someone's password (it upserts).
Run it once locally now so you have a login to test with, and again against
production once Postgres is set up (see below) — it just needs `DATABASE_URL`
pointed at whichever database you want the login created in.

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
   to watch every channel the bot's been invited to.

Until this is configured the route just 401s (bad/missing signature) —
nothing else in the app is affected.

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
