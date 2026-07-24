# Roadmap

## Phase 1 — App foundation (done)

- [x] Next.js app with Google-OAuth login restricted to an email allowlist.
- [x] Prisma/SQLite data model (Property, Transaction, Receipt, PaymentMethod, Category).
- [x] Existing Python matcher (`bofa.py`/`citi.py`/`home_depot.py`/`houses.py`/`match.py`) reused unmodified behind `receipt-recon/service.py`.
- [x] Add Receipt page — camera capture (`capture="environment"`) or file upload, with required Property/Description/Payment Method.
- [x] Upload Statement page — drag-drop BofA/Citi PDF or Home Depot CSV, auto-parsed and matched.
- [x] Review dashboard — needs-review queue with inline property assignment; manual entry for bank transfer/Zelle/wire (no PDF to parse for those).
- [x] Monthly owner-billing + overhead report, CSV export.
- [x] Subscription detector (recurring vendor+amount across 2+ months).
- [x] Google Drive storage adapter (falls back to local disk until credentials are set).
- [x] Notion ledger sync adapter (no-ops until credentials are set).

## Phase 2 — Slack bot + hosting (code built; deployment is on you)

- [x] Slack Events API webhook (`app/api/slack/events/route.ts`) — verifies Slack's request signature, handles the URL-verification handshake, filters to configured channels, downloads photos/PDFs people post, resolves the property from the caption text via the same `houses.py` alias rules the CLI uses (`/resolve-property` on the matching service), and feeds into the same `createReceipt()` pipeline the app's Add Receipt form uses. Lands in the needs-review queue (see `/review`) rather than a guessed property when the caption doesn't confidently resolve one — never silently misfiled. De-dupes on Slack's automatic retries. Tested end-to-end with simulated signed Slack payloads (`web/scripts/smoke-test-slack.ts`), not yet against a real Slack app.
- [x] Slack history backfill search (`lib/slack-ingest.ts`, `/api/slack/sync`) — a second, independent path alongside the live webhook: periodically re-scans channel history for receipt/invoice files the webhook missed (posted before the bot was added, or during any downtime). Same dedup (`slackChannel`+`slackTs`), same needs-review fallback. Hourly Vercel Cron + a "Search Slack Now" button on `/email-accounts`. Verified against the real Slack workspace (auth + the `not_in_channel` error path both confirmed live) — full happy-path (a real message with a file actually getting filed) still needs the bot invited to a real channel to test, since that's a real, visible action on the live workspace this agent won't take unprompted.
- [x] `receipt-recon/Dockerfile` — containerizes the matching service for deployment. Not build-tested (no Docker on the dev machine this was built on) — verify with `docker build .` if you have Docker, or check the host's build logs after deploying.
- [x] Postgres-ready schema + documented migration procedure (see `web/SETUP.md`) — local dev stays on SQLite since it's simpler and there's no functional difference for a single dev; production needs a real Postgres (Neon recommended).
- [ ] Actually deploy `web/` (Vercel) and the matching service (Render/Fly/Railway) so the Slack webhook and team logins work without this dev machine running.
- [ ] Create the real Slack app and invite the bot to the receipt/supply/other/CEO channels.
- [ ] Provision production Postgres and run the migration switch.
- **You'll need to provision:** a Vercel account (or similar) for the web app, a Docker-capable host for the matching service, a Slack app (api.slack.com — bot token + signing secret), a Postgres database (Neon recommended). Exact steps for all four are in `web/SETUP.md`.

## Phase 3 — Email auto-ingestion (5 inboxes, hourly)

- [x] Built: `/email-accounts` admin page to connect any inbox via its own Google OAuth grant (Gmail read-only scope — a service account can't reach personal `@gmail.com` inboxes the way it can a shared Drive folder); Gmail search for vendor order confirmations/invoices; PDF attachment (or rendered-body fallback) filed as a needs-review receipt; "Search Now" button + daily Vercel Cron (`web/vercel.json` — Hobby plan rejects an hourly schedule at deploy time, so it's once/day until upgrading to Pro) hitting the same sync logic; a "Needs Review" assignment queue on `/review` since an order-confirmation email can't say which property it's for.
- [ ] Connect the actual inboxes: `drewmaclurg@gmail.com`, `luxurydesertescapes@gmail.com`, `dmaclurg@luxurydesertescapes.com`, `reservations@luxurydesertescapes.com`, `invoicelde@gmail.com` — click "+ Connect an Inbox" once per inbox on the deployed `/email-accounts` page.
- **You'll need to provision:** a Google Cloud OAuth client (Gmail API enabled) — see `web/SETUP.md` §5 for exact steps — plus logging into each of the 5 inboxes once to grant access. Note: Vercel Hobby-tier Crons only run once/day (an hourly schedule fails the deploy outright); use "Search Now" or upgrade to Pro if you need more-than-daily freshness.

## Phase 4 — Reminders & subscription review

- [ ] Weekly Slack/email nudge listing unmatched charges to whoever's responsible.
- [ ] Monthly subscription report turned into an actual keep/cancel workflow (the Phase 1 Subscriptions page only detects and displays today).
