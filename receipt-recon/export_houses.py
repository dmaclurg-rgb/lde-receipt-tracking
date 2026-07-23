"""Export the canonical house/property list to JSON for the web app.

The web app's Property table must never drift from houses.py (the source of
truth used by the matcher). Run this whenever houses.py changes:

    python3 export_houses.py > ../web/prisma/seed-properties.json
"""

from __future__ import annotations

import json

import houses

if __name__ == "__main__":
    print(json.dumps(houses.all_canonical_names(), indent=2))
