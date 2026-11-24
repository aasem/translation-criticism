"""Comparisons: several reports of the same source passage, lined up.

Nothing here re-scores a translation. Every figure comes from the member reports,
each measured only against the source; this module aligns them, finds the lowest
penalty per segment and the segments that are hard for everyone, checks that the
same departure got the same code and severity across translations, and enforces
the rule for the preferred translation. assets/common.js mirrors analyse() and
figures(); tests/test_compare.py checks that both agree.
"""
from __future__ import annotations

import re

from jsonschema import Draft202012Validator

from . import spec as M
from .normalize import dumps, normalize_comparison
from .scoring import band_for, fixed, groups, proximity, tally
from .scoring import figures as report_figures
from .validate import _SPACE, Issue

_TOKEN = re.compile(r"\{([\w]+(?:\.\d+)?)\}")
_PER_MEMBER = ["score", "band", "total", "severe", "penalty", "pp100", "A", "B", "C", "wins"]
_GLOBAL = ["segments", "words", "members", "hard", "ties"]


def _squash(s):
    return _SPACE.sub("", s or "")


def member_label(entry: dict, report: dict, k: int) -> str:
    """k is 1-based."""
    sub = report.get("submission") or {}
    return (entry.get("label") or sub.get("translator") or sub.get("label") or f"Translation {k}").strip()


def _scored(seg: dict) -> list[dict]:
    scored = set(M.scored_severities())
    return [d for d in seg.get("deviations") or [] if d["severity"] in scored]


def analyse(cmp: dict, reports: list[dict]) -> dict:
    """reports are the member reports in the order of cmp['members']."""
    w = M.weights()
    members = []
    for k, (entry, r) in enumerate(zip(cmp.get("members") or [], reports), start=1):
        t, f, p = tally(r), report_figures(r), proximity(r)
        members.append({
            "id": r.get("id"), "label": member_label(entry, r, k), "stage": r.get("stage"),
            "outcome": r.get("grade") if r.get("stage") == "Published" else r.get("decision"),
            "score": t["score"], "pp100": t["pp100"], "penalty": t["penalty"], "band": t["band"]["letter"],
            "total": t["n"], "severe": t["total"]["Critical"] + t["total"]["Major"],
            "A": f["A"], "B": f["B"], "C": f["C"], "proximity": p["score"], "mimicry": p["mimicry"], "wins": 0,
        })
    gs = [groups(r) for r in reports]
    n = min((len(g) for g in gs), default=0)
    segs = []
    for i in range(n):
        per = [g[i] for g in gs]  # each: the rows of sentence i+1 in one translation
        devs = [[d for s in rows for d in s.get("deviations") or []] for rows in per]
        pens = [sum(w[d["severity"]] for d in ds) for ds in devs]
        low = min(pens) if pens else 0
        lowest = [k for k, x in enumerate(pens) if x == low]
        tie = len(lowest) == len(pens)
        scored = set(M.scored_severities())
        codesets = [{d["code"] for d in ds if d["severity"] in scored} for ds in devs]
        hard = all(codesets)
        shared = sorted(set.intersection(*codesets)) if codesets else []
        if not tie:
            for k in lowest:
                members[k]["wins"] += 1
        segs.append({"n": i + 1, "penalties": pens, "lowest": lowest, "tie": tie, "hard": hard, "shared": shared})
    return {
        "members": members, "segments": segs,
        "hard": [s["n"] for s in segs if s["hard"]], "ties": sum(s["tie"] for s in segs),
        "words": tally(reports[0])["words"] if reports else 0,
    }


def figures(cmp: dict, reports: list[dict]) -> dict:
    """Tokens for comparative prose: {score.1}, {band.2}, {hard}, …"""
    a = analyse(cmp, reports)
    f = {"segments": len(a["segments"]), "words": a["words"], "members": len(a["members"]),
         "hard": len(a["hard"]), "ties": a["ties"]}
    for k, m in enumerate(a["members"], start=1):
        g = band_for(m["pp100"])
        f.update({f"score.{k}": fixed(m["score"]), f"band.{k}": f'{g["letter"]} ({g["name"]})',
                  f"total.{k}": m["total"], f"severe.{k}": m["severe"], f"penalty.{k}": m["penalty"],
                  f"pp100.{k}": fixed(m["pp100"]), f"A.{k}": m["A"], f"B.{k}": m["B"], f"C.{k}": m["C"],
                  f"wins.{k}": m["wins"]})
    return f


def consistency(cmp: dict, reports: list[dict]) -> list[dict]:
    """The same code in the same segment carrying different severities across translations.
    Not always wrong (the departures may differ), so these are flagged for the assessor."""
    out = []
    labels = [member_label(e, r, k) for k, (e, r) in enumerate(zip(cmp.get("members") or [], reports), start=1)]
    gs = [groups(r) for r in reports]
    for i in range(min((len(g) for g in gs), default=0)):
        by_code: dict[str, dict[str, set]] = {}
        for lab, g in zip(labels, gs):
            for s in g[i]:
                for d in s.get("deviations") or []:
                    by_code.setdefault(d["code"], {}).setdefault(lab, set()).add(d["severity"])
        for code, who in by_code.items():
            if len(who) >= 2 and len(set().union(*who.values())) > 1:
                out.append({"n": i + 1, "code": code, "severities": {k: sorted(v) for k, v in who.items()}})
    return out


def alignment_issues(reports: list[dict], ids: list[str]) -> list[Issue]:
    out = []
    if not reports:
        return out
    base, bid = reports[0], ids[0]
    for r, rid in zip(reports[1:], ids[1:]):
        if (r.get("source") or {}).get("language") != (base.get("source") or {}).get("language"):
            out.append(Issue("error", "members", f"{rid}: source language differs from {bid}"))
        if (r.get("submission") or {}).get("language") != (base.get("submission") or {}).get("language"):
            out.append(Issue("error", "members", f"{rid}: target language differs from {bid}"))
        if _squash((r.get("source") or {}).get("text")) != _squash((base.get("source") or {}).get("text")):
            out.append(Issue("error", "members", f"{rid}: source passage differs from {bid}"))
        a = [" ".join(s.get("source", "") for s in g) for g in groups(r)]
        b = [" ".join(s.get("source", "") for s in g) for g in groups(base)]
        if len(a) != len(b):
            out.append(Issue("error", "members", f"{rid}: {len(a)} sentences, {bid} has {len(b)}; reuse the held segmentation"))
        else:
            for k, (x, y) in enumerate(zip(a, b), start=1):
                if _squash(x) != _squash(y):
                    out.append(Issue("error", "members", f"{rid}: source of sentence {k} differs from {bid}; reuse the held segmentation"))
                    break
    return out


def validate_comparison(c: dict, reports_by_id: dict[str, dict], *, text: str | None = None,
                        stem: str | None = None) -> list[Issue]:
    issues: list[Issue] = []
    E = lambda p, m: issues.append(Issue("error", p, m))
    W = lambda p, m: issues.append(Issue("warning", p, m))
    for e in sorted(Draft202012Validator(M.comparison_schema()).iter_errors(c), key=lambda e: list(map(str, e.absolute_path))):
        E("/".join(map(str, e.absolute_path)), e.message)
    if stem is not None and c.get("id") != stem:
        E("id", f"{c.get('id')!r} does not match the file name {stem!r}")
    if text is not None and dumps(normalize_comparison(c)) != text:
        E("", "not in canonical form; run: python -m tc_core normalize --write <file>")

    ids = [m.get("id") for m in c.get("members") or []]
    if len(ids) != len(set(ids)):
        E("members", "a report is listed twice")
    missing = [i for i in ids if i not in reports_by_id]
    for i in missing:
        E("members", f"{i!r} is not a report in reports/")
    if missing or len(ids) < M.method()["comparison"]["minMembers"]:
        return issues
    reports = [reports_by_id[i] for i in ids]
    issues += alignment_issues(reports, ids)
    if any(i.level == "error" for i in issues):
        return issues

    a = analyse(c, reports)
    # Preferred translation: the highest score, or one in the same band with the reason given.
    pref = c.get("preferred")
    if pref not in ids:
        E("preferred", f"{pref!r} is not one of the members")
    else:
        mem = {m["id"]: m for m in a["members"]}
        top = max(a["members"], key=lambda m: m["score"])
        p = mem[pref]
        if p["score"] < top["score"]:
            if p["band"] != top["band"]:
                E("preferred", f"{p['label']} (band {p['band']}) is below the band of the highest score, "
                               f"{top['label']} (band {top['band']}); a preference may only move within the top band")
            else:
                W("preferred", f"{p['label']} is preferred over the higher-scored {top['label']}; the basis must say why")

    # Tokens in the comparative prose.
    k = len(ids)
    for field in ("lead", "tendencies", "preferredBasis", "note", "textNotes"):
        t = c.get(field) or ""
        for tok in _TOKEN.findall(t):
            name, _, num = tok.partition(".")
            ok = (name in _PER_MEMBER and num and 1 <= int(num) <= k) or (tok in _GLOBAL)
            if not ok:
                E(field, f"unknown token {{{tok}}}")
        for m in re.finditer(r"\{score\.(\d+)\}", t):
            if not t[m.end():].startswith(f", in band {{band.{m.group(1)}}}"):
                W(field, f"write the score as '{{score.{m.group(1)}}}, in band {{band.{m.group(1)}}}'")
    for x in consistency(c, reports):
        sv = "; ".join(f"{who}: {', '.join(s)}" for who, s in x["severities"].items())
        W(f"sentence {x['n']}", f"{x['code']} carries different severities ({sv}); check the departures differ")
    return issues
