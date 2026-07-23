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

## Phase 2 — Slack bot + hosting

- [ ] Real Slack app (bot token + Events API) so the receipt/supply/other channels and a CEO channel feed into the same pipeline as app uploads, running independently of any Claude session.
- [ ] Deploy `web/` + `receipt-recon/service.py` somewhere reachable 24/7 (Vercel + a small always-on host for the Python service, or one Docker host).
- [ ] Swap SQLite for production Postgres (`prisma/schema.prisma` datasource).
- **You'll need to provision:** a hosting account, a Slack app (create at api.slack.com, bot token + signing secret), production Postgres.

## Phase 3 — Email auto-ingestion (5 inboxes, hourly)

- [ ] Connect `drewmaclurg@gmail.com`, `luxurydesertescapes@gmail.com`, `reservations@luxurydesertescapes.com`, `invoicelde@gmail.com` (only `dmaclurg@luxurydesertescapes.com` is reachable today).
- [ ] Hourly job scans for Amazon/Instacart/Costco order-confirmation emails and known subscription-charge emails, saves them as PDF to Drive, and logs them to the ledger as "auto-ingested — needs property assignment" (a shopping confirmation email can't tell you which property it's for, so these always land in the review queue).
- **You'll need to provision:** access to the 4 additional inboxes, and a Google Cloud project + Gmail API OAuth client if going the direct-API route.

## Phase 4 — Reminders & subscription review

- [ ] Weekly Slack/email nudge listing unmatched charges to whoever's responsible.
- [ ] Monthly subscription report turned into an actual keep/cancel workflow (the Phase 1 Subscriptions page only detects and displays today).
