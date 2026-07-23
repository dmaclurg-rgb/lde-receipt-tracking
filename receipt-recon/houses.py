"""Canonical house list + alias resolver.

Maps the messy ``Job Name`` strings written on Home Depot receipts (and the
free-text house mentions in Slack captions) to canonical Streamline property
names. Anything that can't be resolved returns ``None`` and the matcher routes
it to the review queue.
"""

from __future__ import annotations

from dataclasses import dataclass


OVERHEAD = "__OVERHEAD__"


@dataclass(frozen=True)
class House:
    canonical: str
    aliases: tuple[str, ...]


# Canonical Streamline property names (from the 05/01/2026 reservations export).
# Aliases are lowercased substrings; resolution is "any alias is contained in
# the input, after lowercasing". Order matters: longer aliases win on ties.
HOUSES: tuple[House, ...] = (
    House("The Stallion Estate", ("stallion", "stalion", "ranch")),
    House("Empire State", ("empire",)),
    House("Lotus Retreat", ("lotus", "lodus")),
    House("Wanderlust", ("wanderlust", "wonderlust")),
    House("Wilder Out West", ("wilder",)),
    House("The Madison Bungalow", ("bungalow", "bungalo")),
    House("Royale", ("royale", "royal")),
    House("Casa Blanca", ("casa blanca", "casablanca")),
    House("Casa Solara", ("casa solara", "casa solera", "casa salero", "solara", "solera", "salero")),
    House("Pura Vida", ("pura vida", "puro villa", "pura viva", "puravida")),
    House("The Hideaway", ("hideaway", "hide away")),
    House("The Montage Resort", ("montage",)),
    House("Luxe Estate", ("luxe", "lux")),
    House("Lazy River Oasis", ("lazy river oasis", "lazy river")),
    House("Cache Estate", ("cache",)),
    House("Desert Haven", ("desert haven",)),
    House("Madison Villa", ("madison villa",)),
    House("Palm Villa", ("palm villa",)),
    House("Vista Estate", ("vista",)),
    House("The Oasis Palm", ("oasis palm",)),
)

# Things that look like houses on receipts but are actually shared business
# expenses ("overhead"). Tracked separately, never billed to an owner.
OVERHEAD_ALIASES: tuple[str, ...] = (
    "overhead",
    "van stock",
    "van shelf",
    "van shelfs",
    "van shelves",
    "van",
)


def resolve(text: str | None) -> str | None:
    """Resolve a free-text house mention to a canonical name.

    Returns the canonical Streamline name, the OVERHEAD sentinel, or None if
    no rule matches (caller routes to the review queue).
    """
    if not text:
        return None
    needle = text.strip().lower()
    if not needle:
        return None

    for alias in sorted(OVERHEAD_ALIASES, key=len, reverse=True):
        if alias in needle:
            return OVERHEAD

    best: tuple[int, str] | None = None
    for house in HOUSES:
        for alias in house.aliases:
            if alias in needle and (best is None or len(alias) > best[0]):
                best = (len(alias), house.canonical)
    return best[1] if best else None


def all_canonical_names() -> list[str]:
    return [h.canonical for h in HOUSES]
