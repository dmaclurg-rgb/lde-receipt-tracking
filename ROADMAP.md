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

- [x] Slack Events API webhook (`app/api/slack/events/route.ts`) — verifies Slack's request signature, handles the URL-verification handshake, filters to configured channels, downloads photos/PDFs people post, resolves the property from the caption text via the same `houses.py` alias rules the CLI uses (`/resolve-property` on the matching service), and feeds into the same `createReceipt()` pipeline the app's Add Receipt form uses. Falls back to Company Overhead + a Slack reply flagging it for review when the property can't be confidently matched — never silently misfiled. De-dupes on Slack's automatic retries. Tested end-to-end with simulated signed Slack payloads (`web/scripts/smoke-test-slack.ts`), not yet against a real Slack app.
- [x] `receipt-recon/Dockerfile` — containerizes the matching service for deployment. Not build-tested (no Docker on the dev machine this was built on) — verify with `docker build .` if you have Docker, or check the host's build logs after deploying.
- [x] Postgres-ready schema + documented migration procedure (see `web/SETUP.md`) — local dev stays on SQLite since it's simpler and there's no functional difference for a single dev; production needs a real Postgres (Neon recommended).
- [ ] Actually deploy `web/` (Vercel) and the matching service (Render/Fly/Railway) so the Slack webhook and team logins work without this dev machine running.
- [ ] Create the real Slack app and invite the bot to the receipt/supply/other/CEO channels.
- [ ] Provision production Postgres and run the migration switch.
- **You'll need to provision:** a Vercel account (or similar) for the web app, a Docker-capable host for the matching service, a Slack app (api.slack.com — bot token + signing secret), a Postgres database (Neon recommended). Exact steps for all four are in `web/SETUP.md`.

## Phase 3 — Email auto-ingestion (5 inboxes, hourly)

- [ ] Connect `drewmaclurg@gmail.com`, `luxurydesertescapes@gmail.com`, `reservations@luxurydesertescapes.com`, `invoicelde@gmail.com` (only `dmaclurg@luxurydesertescapes.com` is reachable today).
- [ ] Hourly job scans for Amazon/Instacart/Costco order-confirmation emails and known subscription-charge emails, saves them as PDF to Drive, and logs them to the ledger as "auto-ingested — needs property assignment" (a shopping confirmation email can't tell you which property it's for, so these always land in the review queue).
- **You'll need to provision:** access to the 4 additional inboxes, and a Google Cloud project + Gmail API OAuth client if going the direct-API route.

## Phase 4 — Reminders & subscription review

- [ ] Weekly Slack/email nudge listing unmatched charges to whoever's responsible.
- [ ] Monthly subscription report turned into an actual keep/cancel workflow (the Phase 1 Subscriptions page only detects and displays today).
