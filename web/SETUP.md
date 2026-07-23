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
cp .env.example .env.local   # then fill in what you have (see below)
npx prisma migrate dev       # creates prisma/dev.db
npx tsx prisma/seed.ts       # seeds Property table from houses.py
npm run dev
```

Open http://localhost:3000. Without any of the credentials below configured,
the app still fully works: files save to `web/local-storage/` instead of
Google Drive, and Notion sync silently no-ops (logs to the console instead of
throwing) — see `lib/storage/index.ts` and `lib/notion.ts`.

## Credentials only you can create

None of these can be provisioned by an AI agent — they require your own
Google/Notion/Slack accounts and, for Google Cloud, billing/consent-screen
setup that only an account owner can click through.

### 1. Google sign-in (required for anyone to log in at all)

1. Go to https://console.cloud.google.com/apis/credentials, create (or reuse)
   a project.
2. Configure the OAuth consent screen (External or Internal, your choice) —
   just needs an app name and support email.
3. Create an OAuth client ID, type **Web application**.
   - Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
     for local dev; add your production URL's equivalent once deployed.
4. Put the client ID/secret in `.env.local` as `AUTH_GOOGLE_ID` /
   `AUTH_GOOGLE_SECRET`.
5. Set `ALLOWED_TEAM_EMAILS` to a comma-separated list of every teammate's
   Google account email (mixing `@luxurydesertescapes.com` and personal
   Gmail addresses is fine — that's exactly what the allowlist is for).

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

### 4. Slack, hosting, additional email inboxes

These are Phase 2/3 work — see [`../ROADMAP.md`](../ROADMAP.md). They need a
Slack app, a hosting account, and access to 4 more inboxes, none of which an
AI agent can create on your behalf.

## Production database

Swap SQLite for Postgres before deploying: change `provider = "sqlite"` to
`provider = "postgresql"` in `prisma/schema.prisma` and point `DATABASE_URL`
at your Postgres instance, then `npx prisma migrate deploy`.
