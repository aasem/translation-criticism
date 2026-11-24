"""Deterministic segmentation of the source (the rule named in method.json, now sentence-v2).

One source sentence is one segment, with no length cap unless method.json sets
maxWords. The same text always gives the same segments, so reports and comparisons
are repeatable. Only the source is segmented: the translation is aligned onto it.
"""
from __future__ import annotations

import re

from . import spec as M
from .scoring import words

_END = re.compile(r"([.?!…]+[\"'”’)\]]*)(\s+)")
_OPENERS = "\"'“‘([«"
_SPACE = re.compile(r"\s+")
_CLOSERS = "\"'”’"


def _reporting(rest: str) -> bool:
    """A reporting verb (said, exclaimed, asked …) within the first few words of what follows."""
    st = _settings()
    verbs = set(st["reportingVerbs"])
    for w in rest.split()[: st["reportingWindow"]]:
        w = w.strip(".,;:!?—–-\"'“”‘’()[]").lower()
        if w in verbs:
            return True
        if w and not w.isalpha():
            break
    return False


def _settings() -> dict:
    return M.method()["segmentation"]


def sentences(text: str) -> list[str]:
    abbr = set(_settings()["abbreviations"])
    out, start = [], 0
    for m in _END.finditer(text or ""):
        before = text[start:m.start()].split()
        last = before[-1].lower().rstrip(".").lstrip("\"'“‘([") if before else ""
        nxt = text[m.end():m.end() + 1]
        if m.group(1) == "." and last in abbr:
            continue
        if not nxt or not (nxt.isupper() or nxt in _OPENERS):
            continue
        if m.group(1)[-1] in _CLOSERS and _reporting(text[m.end():]):
            continue  # quoted speech followed by its reporting clause: one sentence
        out.append(text[start:m.end(1)].strip())
        start = m.end()
    tail = (text or "")[start:].strip()
    if tail:
        out.append(tail)
    return out


def _split_long(s: str, maxw: int, minw: int, order: list[str]) -> list[str]:
    if words(s) <= maxw:
        return [s]
    for mark in order:
        cands = [m.end() for m in re.finditer(re.escape(mark), s)
                 if words(s[:m.end()]) >= minw and words(s[m.end():]) >= minw]
        if cands:
            mid = words(s) / 2
            cut = min(cands, key=lambda c: (abs(words(s[:c]) - mid), c))
            return _split_long(s[:cut].strip(), maxw, minw, order) + _split_long(s[cut:].strip(), maxw, minw, order)
    return [s]


def segment(text: str) -> list[str]:
    """The source segments the rule gives for a passage."""
    st = _settings()
    segs = sentences(text)
    if st.get("maxWords"):
        segs = [p for s in segs for p in _split_long(s, st["maxWords"], st["minWords"], st["splitOrder"])]
    return segs


def _cuts(parts: list[str]) -> list[int]:
    out, a = [], 0
    for p in parts:
        a += len(_SPACE.sub("", p))
        out.append(a)
    return out


def departures(report: dict) -> dict:
    """Where a report's sentences (row groups) differ from the rule: cuts the rule makes that the report
    does not ('joined'), and cuts the report makes that the rule does not ('split'), as sentence numbers."""
    from .scoring import groups
    held = [" ".join(s.get("source", "") for s in g) for g in groups(report)]
    rule = segment((report.get("source") or {}).get("text", ""))
    hc, rc = _cuts(held), _cuts(rule)
    rset = set(rc[:-1])
    split = [i + 1 for i, c in enumerate(hc[:-1]) if c not in rset]
    joined = [i + 1 for i, c in enumerate(hc) if any((hc[i - 1] if i else 0) < x < c for x in rset)]
    return {"split": split, "joined": sorted(set(joined)), "rule": len(rule), "held": len(held)}


def describe(dep: dict) -> str:
    """A one-line statement of the departures, for segmentation.exceptions."""
    nums = lambda xs: ", ".join(f"#{n}" for n in xs)
    parts = []
    if dep["split"]:
        parts.append(f"{nums(dep['split'])} end inside a sentence")
    if dep["joined"]:
        parts.append(f"{nums(dep['joined'])} run across a sentence end")
    return "; ".join(parts)
