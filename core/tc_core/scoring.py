"""Scoring: counts, MQM-weighted penalty, quality score, band, spread, proximity and mimicry.

This is the reference implementation. assets/common.js computes the same figures
in the browser, and tests/test_parity.py checks that both agree on every report.
"""
from __future__ import annotations

import math
import re
import unicodedata
from decimal import ROUND_HALF_UP, Decimal

from . import spec as M

# JavaScript's \s, so word counts match the browser exactly.
_JS_SPACE = "\t\n\v\f\r    -     　﻿"
_TOKEN = re.compile(f"[^{_JS_SPACE}]+")


def fixed(x: float, places: int = 1) -> str:
    """Number.prototype.toFixed: exact value of the float, ties away from zero."""
    q = Decimal(1).scaleb(-places)
    return str(Decimal(x).quantize(q, rounding=ROUND_HALF_UP))


def words(text: str | None) -> int:
    """Whitespace-separated tokens containing a letter or a digit (a lone dash is not a word)."""
    return sum(
        1
        for tok in _TOKEN.findall(text or "")
        if any(unicodedata.category(ch)[0] in "LN" for ch in tok)
    )


def band_for(pp100: float) -> dict:
    for g in M.grades():
        if g["maxPp100"] is None or pp100 <= g["maxPp100"]:
            return g
    return M.grades()[-1]


def tally(report: dict) -> dict:
    sev = M.severities()
    total = {s: 0 for s in sev}
    by_code: dict[str, dict[str, int]] = {}
    for seg in report.get("segments") or []:
        for d in seg.get("deviations") or []:
            by_code.setdefault(d["code"], {s: 0 for s in sev})
            by_code[d["code"]][d["severity"]] = by_code[d["code"]].get(d["severity"], 0) + 1
            total[d["severity"]] = total.get(d["severity"], 0) + 1
    w = M.weights()
    scored = M.scored_severities()
    n = sum(total[s] for s in scored)
    nwords = words((report.get("source") or {}).get("text"))
    penalty = sum(total[s] * w[s] for s in scored)
    pp100 = 100 * penalty / nwords if nwords else 0.0
    score = max(0.0, 100 * (1 - penalty / nwords)) if nwords else 0.0
    return {
        "byCode": by_code, "total": total, "n": n, "neutral": total.get("Neutral", 0),
        "words": nwords, "penalty": penalty, "pp100": pp100, "score": score, "band": band_for(pp100),
    }


def agreement(report: dict) -> dict:
    with_ai = [s for s in report.get("segments") or [] if (s.get("suggestion") or {}).get("ai", "").strip()]
    state = lambda s: (s.get("suggestion") or {}).get("state") or "Not reviewed"
    return {
        "aiSugg": len(with_ai),
        "agree": sum(state(s) == "Agrees with AI" for s in with_ai),
        "differ": sum(state(s) == "Own suggestion" for s in with_ai),
        "unreviewed": sum(state(s) == "Not reviewed" for s in with_ai),
    }


def figures(report: dict) -> dict:
    """Every figure a prose token can refer to, formatted as the site shows it."""
    t = tally(report)
    segs = report.get("segments") or []
    scored = set(M.scored_severities())
    per100 = lambda x: fixed(100 * x / t["words"]) if t["words"] else "–"
    pct = lambda k: math.floor(100 * k / len(segs) + 0.5) if segs else 0  # Math.round
    seg_scored = lambda s: [d for d in s.get("deviations") or [] if d["severity"] in scored]
    f = {
        "total": t["n"], "critical": t["total"]["Critical"], "major": t["total"]["Major"],
        "minor": t["total"]["Minor"], "severe": t["total"]["Critical"] + t["total"]["Major"],
        "per100": per100(t["n"]), "words": t["words"], "segments": len(segs),
        "penalty": t["penalty"], "pp100": fixed(t["pp100"]), "score": fixed(t["score"]),
        "band": f'{t["band"]["letter"]} ({t["band"]["name"]})', "A": 0, "B": 0, "C": 0,
        "neutral": t["neutral"],
    }
    f["clean"] = sum(1 for s in segs if not seg_scored(s))
    f["severeSegs"] = sum(1 for s in segs if any(d["severity"] != "Minor" for d in seg_scored(s)))
    f.update(agreement(report))
    f["cleanPct"] = pct(f["clean"])
    f["severePct"] = pct(f["severeSegs"])
    for code in M.codes():
        x = t["byCode"].get(code)
        k = sum(x[s] for s in scored) if x else 0
        f[code] = k
        f[code[0]] += k
    return f


_TOK = re.compile(r"\{(\w+)\}")


def fill(text: str, figs: dict) -> str:
    return _TOK.sub(lambda m: str(figs[m.group(1)]) if m.group(1) in figs else m.group(0), text or "")


def proximity(report: dict) -> dict:
    """Proximity = kept / total (descriptive); mimicry = forced / kept (the assessor's mark)."""
    pmin = M.method()["proximity"]["min"]
    comps = []
    for key in M.method()["proximity"]["keys"]:
        x = (report.get("proximity") or {}).get(key) or {}
        total, kept = int(x.get("total") or 0), int(x.get("kept") or 0)
        forced = None if x.get("forced") in (None, "") else int(x["forced"])
        comps.append({
            "key": key, "kept": kept, "total": total, "forced": forced,
            "counted": total >= pmin, "pct": 100 * kept / total if total else None,
            "artCounted": forced is not None and kept >= pmin,
            "artPct": 100 * forced / kept if forced is not None and kept else None,
        })
    avg = lambda xs: sum(xs) / len(xs) if xs else None
    return {
        "comps": comps,
        "score": avg([c["pct"] for c in comps if c["counted"]]),
        "mimicry": avg([c["artPct"] for c in comps if c["artCounted"]]),
    }


def default_outcome(report: dict) -> str:
    """The decision or grade the score band points to."""
    letter = tally(report)["band"]["letter"]
    return letter if report.get("stage") == "Published" else M.decision_for_band(letter)


def outcome_steps(report: dict) -> int | None:
    """How many steps the recorded outcome sits from the band's default (None if unset)."""
    letter = tally(report)["band"]["letter"]
    order = M.grade_letters()
    if report.get("stage") == "Published":
        g = report.get("grade")
        return abs(order.index(g) - order.index(letter)) if g in order else None
    d = report.get("decision")
    keys = M.decision_keys()
    return abs(keys.index(d) - keys.index(M.decision_for_band(letter))) if d in keys else None


def summary(report: dict) -> dict:
    """A compact, API-ready summary of one report."""
    t, p = tally(report), proximity(report)
    return {
        "id": report.get("id"), "stage": report.get("stage"),
        "words": t["words"], "penalty": t["penalty"], "pp100": round(t["pp100"], 3),
        "score": round(t["score"], 3), "band": t["band"]["letter"],
        "outcome": report.get("grade") if report.get("stage") == "Published" else report.get("decision"),
        "defaultOutcome": default_outcome(report), "outcomeSteps": outcome_steps(report),
        "counts": t["total"], "proximity": p["score"], "mimicry": p["mimicry"],
    }
