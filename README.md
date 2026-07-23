# Luxury Desert Escapes — Receipt Tracking & Reconciliation

An ongoing system for tracking every company purchase (bank transfer, Zelle,
wire, Bank of America card, Citi card, Home Depot card), matching it to a
receipt/invoice, and splitting it between company overhead and owner-billable
property expenses — so every charge on every statement is accounted for if
the business is ever audited.

See [`.claude/plans/distributed-sleeping-ripple.md`](.claude/plans/distributed-sleeping-ripple.md)
for the full design plan, and [`ROADMAP.md`](ROADMAP.md) for what's built vs.
what's next.

## Layout

- **`receipt-recon/`** — the original Python engine (started 2026-05-01):
  parses BofA/Citi statement PDFs and Home Depot CSV exports, resolves the
  correct property from job-name text, and three-way matches
  charge ↔ receipt ↔ house. Still fully usable as a standalone CLI
  (`python3 reconcile.py ...`). Now also exposed over HTTP via
  `service.py` so the web app can reuse it without a rewrite.
- **`web/`** — the Next.js app: team login, camera-capture and file-upload
  receipt intake, statement upload, the review/reconciliation dashboard,
  monthly owner-billing reports, and subscription detection. See
  [`web/SETUP.md`](web/SETUP.md) for how to run it and which credentials you
  need to provision yourself before Drive/Notion/Slack go live.

## Running it locally

```bash
# 1. Start the Python matching service (from receipt-recon/)
cd receipt-recon
.venv/bin/uvicorn service:app --port 8008 --reload

# 2. In another terminal, start the web app (from web/)
cd web
npm run dev
```

Then open http://localhost:3000. Full setup (Google OAuth, Google Drive,
Notion, Slack) is in [`web/SETUP.md`](web/SETUP.md).

## Team development access

This is a git repo — create a private GitHub repo and push this history,
then invite teammates as collaborators so they can help build out Phases
2–4 (see `ROADMAP.md`). That last step (creating the GitHub repo, inviting
people) is yours to do since it involves your own GitHub account.
