"""HTTP wrapper around the existing reconciliation engine, for the web app.

Reuses bofa.py, citi.py, home_depot.py, houses.py, match.py, and reconcile.py
unmodified — this file only adds (de)serialization and an HTTP surface so
Next.js (web/) can drive the same parsing/matching logic the CLI uses,
without reimplementing it in TypeScript.

Run locally with:

    receipt-recon/.venv/bin/uvicorn service:app --port 8008 --reload
"""

from __future__ import annotations

import tempfile
from dataclasses import asdict
from decimal import Decimal
from pathlib import Path
from typing import Any

from fastapi import FastAPI, UploadFile
from fastapi.middleware.cors import CORSMiddleware

import bofa
import citi
import home_depot
import houses
import match
from reconcile import _sniff

app = FastAPI(title="receipt-recon matching service")

# The Next.js dev server runs on a different port; this service is only ever
# called server-side from Next.js API routes in production, but CORS is
# opened for local development convenience (calling it directly while
# iterating).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _jsonable(value: Any) -> Any:
    """Recursively convert dataclasses/Decimal/date into JSON-safe values."""
    if isinstance(value, Decimal):
        return str(value)
    if hasattr(value, "isoformat"):
        return value.isoformat()
    if isinstance(value, dict):
        return {k: _jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_jsonable(v) for v in value]
    return value


def _charge_dict(c: bofa.Charge) -> dict:
    return _jsonable(asdict(c))


def _hd_row_dict(r: home_depot.HDRow) -> dict:
    d = asdict(r)
    d.pop("raw", None)
    return _jsonable(d)


def _match_dict(m: match.Match) -> dict:
    return {
        "charge": _charge_dict(m.charge),
        "receipts": [_hd_row_dict(r) for r in m.receipts],
        "house": None if m.house is None else (
            "OVERHEAD" if m.house == houses.OVERHEAD else m.house
        ),
        "is_split": m.is_split,
        "needs_review": m.needs_review,
    }


async def _save_upload(upload: UploadFile, tmpdir: Path) -> Path:
    dest = tmpdir / upload.filename
    data = await upload.read()
    dest.write_bytes(data)
    return dest


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/properties")
def properties() -> dict:
    """Canonical property list — kept in sync with web/prisma/seed-properties.json
    via receipt-recon/export_houses.py."""
    return {"properties": houses.all_canonical_names()}


@app.post("/parse-statement")
async def parse_statement(file: UploadFile) -> dict:
    """Parse a single BofA/Citi PDF or Home Depot CSV, no matching."""
    with tempfile.TemporaryDirectory() as tmp:
        path = await _save_upload(file, Path(tmp))
        kind = _sniff(path)
        if kind == "bofa":
            charges = bofa.parse_pdf(path)
            return {"kind": "bofa", "charges": [_charge_dict(c) for c in charges]}
        if kind == "citi":
            charges = citi.parse_pdf(path)
            return {"kind": "citi", "charges": [_charge_dict(c) for c in charges]}
        if kind == "hd":
            rows = home_depot.parse_csv(path)
            return {"kind": "hd", "rows": [_hd_row_dict(r) for r in rows]}
        return {"kind": "unknown", "error": f"could not detect statement type for {file.filename}"}


@app.post("/reconcile")
async def reconcile(files: list[UploadFile]) -> dict:
    """Parse + three-way match a batch of statements/CSVs.

    Mirrors reconcile.py's CLI behavior exactly (same sniffing, same
    match.reconcile call) so results are consistent with the existing tool.
    """
    with tempfile.TemporaryDirectory() as tmp:
        tmpdir = Path(tmp)
        all_charges: list[bofa.Charge] = []
        all_hd: list[home_depot.HDRow] = []
        skipped: list[str] = []

        for upload in files:
            path = await _save_upload(upload, tmpdir)
            kind = _sniff(path)
            if kind == "bofa":
                all_charges.extend(bofa.parse_pdf(path))
            elif kind == "citi":
                all_charges.extend(citi.parse_pdf(path))
            elif kind == "hd":
                all_hd.extend(home_depot.parse_csv(path))
            else:
                skipped.append(upload.filename or "unknown")

        matches, unmatched, orphans = match.reconcile(all_charges, all_hd)

        return {
            "matches": [_match_dict(m) for m in matches],
            "unmatched": [
                {"charge": _charge_dict(u.charge), "reason": u.reason} for u in unmatched
            ],
            "orphans": [
                {"row": _hd_row_dict(o.row), "reason": o.reason} for o in orphans
            ],
            "skipped_files": skipped,
        }
