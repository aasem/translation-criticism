"""Canonical form of a report: upgrade old versions, fill every missing field, fix key order.

The schema carries a default for every property, and normalizing walks the schema,
so a report written by the skill, the site editor or a future API comes out with
the same keys in the same order. Unknown keys are kept (at the end of their object)
so nothing is lost silently; the validator then reports them.
"""
from __future__ import annotations

import copy
import json
import re

from .spec import comparison_schema, report_schema

SCHEMA_VERSION = 2
_MISSING = object()
_MERGED = re.compile(r"^\(merged into #(\d+)\)$")


def _resolve(s: dict, root: dict) -> dict:
    while "$ref" in s:
        s = root["$defs"][s["$ref"].rsplit("/", 1)[-1]]
    return s


def _types(s: dict) -> list[str]:
    t = s.get("type", [])
    return t if isinstance(t, list) else [t]


def _norm(v, s: dict, root: dict):
    s = _resolve(s, root)
    types = _types(s)
    if v is _MISSING or (v is None and "null" not in types):
        if "object" in types:
            v = {}
        else:
            return copy.deepcopy(s.get("default"))
    if "object" in types and isinstance(v, dict):
        props = s.get("properties", {})
        out = {k: _norm(v.get(k, _MISSING), ps, root) for k, ps in props.items()}
        out.update({k: x for k, x in v.items() if k not in props})
        return out
    if "array" in types and isinstance(v, list):
        items = s.get("items")
        return [_norm(x, items, root) for x in v] if items else v
    if "integer" in types:
        if isinstance(v, str):
            v = v.strip()
            if v == "" and "null" in types:
                return None
            if re.fullmatch(r"\d+", v):
                return int(v)
        if isinstance(v, float) and v.is_integer():
            return int(v)
    return v


def upgrade(report: dict) -> tuple[dict, list[str]]:
    """Bring an older report up to the current schema. Returns the report and what changed."""
    r = copy.deepcopy(report)
    notes: list[str] = []
    if r.get("schema", 1) < 2:
        for seg in r.get("segments") or []:
            m = _MERGED.match((seg.get("submission") or "").strip())
            if m:
                seg["mergedInto"] = int(m.group(1))
                seg["submission"] = ""
                notes.append(f"segment {seg.get('n')}: merge marker moved to mergedInto={m.group(1)}")
        if "_comment" in r:
            del r["_comment"]
            notes.append("dropped _comment (guidance now lives in the README)")
        r["schema"] = 2
        notes.append("schema 1 -> 2")
    # Outcome fields of the other stage: clear leftovers only when nothing was written for them.
    other = (("decision", "decisionBasis", "publisherNote") if r.get("stage") == "Published"
             else ("grade", "gradeBasis", "readerNote"))
    if r.get(other[0]) and not any((r.get(k) or "").strip() for k in other[1:]):
        notes.append(f"cleared leftover {other[0]}={r[other[0]]!r} (not used at stage {r.get('stage')})")
        r[other[0]] = ""
    return r, notes


def normalize(report: dict, schema: dict | None = None) -> dict:
    root = schema or report_schema()
    return _norm(report, root, root)


def normalize_comparison(c: dict) -> dict:
    return normalize(c, comparison_schema())


def canonical(report: dict) -> tuple[dict, list[str]]:
    r, notes = upgrade(report)
    return normalize(r), notes


def dumps(report: dict) -> str:
    """Serialised exactly as the site writes it: JSON.stringify(r, null, 2) + newline."""
    return json.dumps(report, indent=2, ensure_ascii=False) + "\n"
