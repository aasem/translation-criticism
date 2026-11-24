"""The assessment method as data, loaded once from method.json.

Everything the scoring depends on (codes, weights, bands, decisions) lives in
method.json, so the site, this package and any future service share one
definition. Change the method there, then run `python -m tc_core build-js`.
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

HERE = Path(__file__).parent
METHOD_PATH = HERE / "method.json"
SCHEMA_PATH = HERE / "schema" / "report.schema.json"


@lru_cache(maxsize=None)
def method() -> dict:
    return json.loads(METHOD_PATH.read_text(encoding="utf-8"))


@lru_cache(maxsize=None)
def report_schema() -> dict:
    return json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))


def codes() -> dict[str, dict]:
    return {c["code"]: c for c in method()["codes"]}


def segment_codes() -> list[str]:
    """Codes that may be recorded on a segment (pattern codes such as C4 are not)."""
    pattern = set(method()["patternCodes"])
    return [c["code"] for c in method()["codes"] if c["code"] not in pattern]


def weights() -> dict[str, int]:
    return {s["name"]: s["weight"] for s in method()["severities"]}


def severities() -> list[str]:
    return [s["name"] for s in method()["severities"]]


def scored_severities() -> list[str]:
    return [s["name"] for s in method()["severities"] if s["weight"] > 0]


def grades() -> list[dict]:
    return method()["grades"]


def grade_letters() -> list[str]:
    return [g["letter"] for g in grades()]


def decisions() -> list[dict]:
    return method()["decisions"]


def decision_keys() -> list[str]:
    return [d["key"] for d in decisions()]


def decision_for_band(letter: str) -> str:
    return next(d["key"] for d in decisions() if d["band"] == letter)


def token_names() -> set[str]:
    return set(method()["tokens"]) | set(codes())
