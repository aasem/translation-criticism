"""Validation: the JSON Schema first, then the rules a schema cannot express.

Errors block a commit. Warnings flag things the assessor may have meant
(an outcome moved one step, a review state without text) and never block.
"""
from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass
from pathlib import Path

from jsonschema import Draft202012Validator

from . import spec as M
from .normalize import canonical, dumps
from .scoring import outcome_steps, tally

PROSE = ["lead", "textNotes", "profileSummary", "tendencies", "translatorProfile",
         "decisionBasis", "publisherNote", "gradeBasis", "readerNote"]
_SPACE = re.compile("[\t\n\v\f\r    -     　﻿]+")
_TOKEN = re.compile(r"\{(\w+)\}")


@dataclass
class Issue:
    level: str  # "error" | "warning"
    path: str
    message: str

    def __str__(self) -> str:
        return f"{self.level.upper():7} {self.path or '(report)'}: {self.message}"


def _squash(s: str) -> str:
    return _SPACE.sub("", s or "")


def schema_issues(report: dict) -> list[Issue]:
    v = Draft202012Validator(M.report_schema())
    out = []
    for e in sorted(v.iter_errors(report), key=lambda e: list(map(str, e.absolute_path))):
        out.append(Issue("error", "/".join(map(str, e.absolute_path)), e.message))
    return out


def rule_issues(r: dict) -> list[Issue]:
    out: list[Issue] = []
    E = lambda p, m: out.append(Issue("error", p, m))
    W = lambda p, m: out.append(Issue("warning", p, m))
    segs = r.get("segments") or []
    by_n = {s.get("n"): s for s in segs}

    # Segments: numbering, merges, and that the segments rebuild the passages.
    for i, s in enumerate(segs):
        if s.get("n") != i + 1:
            E(f"segments/{i}/n", f"is {s.get('n')}, expected {i + 1}")
    if _squash("".join(s.get("source", "") for s in segs)) != _squash((r.get("source") or {}).get("text")):
        E("segments", "source segments joined do not equal source.text (ignoring whitespace)")
    if _squash("".join(s.get("submission", "") for s in segs)) != _squash((r.get("submission") or {}).get("text")):
        E("segments", "translation segments joined do not equal submission.text (ignoring whitespace)")
    for i, s in enumerate(segs):
        p, m = f"segments/{i}", s.get("mergedInto")
        if m is not None:
            if not (isinstance(m, int) and 1 <= m < s.get("n", 0)):
                E(f"{p}/mergedInto", f"{m} must name an earlier segment")
            elif by_n.get(m, {}).get("mergedInto") is not None:
                E(f"{p}/mergedInto", f"segment {m} is itself merged; point to the segment that holds the sentence")
            if (s.get("submission") or "").strip():
                E(f"{p}/submission", "must be empty when mergedInto is set")
        elif not (s.get("submission") or "").strip():
            E(f"{p}/submission", "empty, but mergedInto is not set")

        # Deviations.
        devs = s.get("deviations") or []
        for j, d in enumerate(devs):
            q = f"{p}/deviations/{j}"
            if not (d.get("note") or "").strip():
                E(f"{q}/note", "a deviation needs a note")
            cb = d.get("compensatedBy")
            if cb is not None:
                if cb not in by_n or cb == s.get("n"):
                    E(f"{q}/compensatedBy", f"{cb} is not another segment of this report")
                if d.get("severity") != "Neutral":
                    E(f"{q}/compensatedBy", "only a Neutral deviation is compensated")
            fns = d.get("functions") or []
            if fns:
                lost = sum(not f.get("kept") for f in fns)
                if lost == 0 and d.get("severity") != "Neutral":
                    W(f"{q}/severity", "every function kept, so the function test gives Neutral")
                if lost and d.get("severity") == "Neutral":
                    W(f"{q}/severity", "a function is lost, so the function test gives at least Minor")
            if d.get("severity") == "Neutral" and not fns and cb is None:
                W(f"{q}", "Neutral without a function test or compensatedBy")

        # Suggestions: an AI rendering for every segment with a deviation, and only for those.
        g = s.get("suggestion") or {}
        ai = (g.get("ai") or "").strip()
        if devs and not ai:
            E(f"{p}/suggestion/ai", "segment has deviations but no AI suggestion")
        if not devs and ai:
            E(f"{p}/suggestion/ai", "segment has no deviation, so it gets no AI suggestion")
        for ch in M.method()["forbiddenInAISuggestions"]:
            if ch in ai:
                E(f"{p}/suggestion/ai", f"contains {ch!r} (no semicolons in Urdu)")
        human, state = (g.get("human") or "").strip(), g.get("state")
        if state == "Own suggestion" and not human:
            W(f"{p}/suggestion", "state is Own suggestion but the human column is empty")
        if state != "Own suggestion" and human:
            W(f"{p}/suggestion", f"human text present but state is {state!r}")

    if any((s.get("suggestion") or {}).get("ai", "").strip() for s in segs):
        a = r.get("aiSuggestions") or {}
        if not (a.get("model") or "").strip() or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", a.get("date") or ""):
            E("aiSuggestions", "model and date (YYYY-MM-DD) are needed when AI suggestions exist")

    # Proximity counts.
    for k, x in (r.get("proximity") or {}).items():
        if not isinstance(x, dict):
            continue
        if (x.get("kept") or 0) > (x.get("total") or 0):
            E(f"proximity/{k}", "kept exceeds total")
        if x.get("forced") is not None and x["forced"] > (x.get("kept") or 0):
            E(f"proximity/{k}", "forced exceeds kept")

    # Prose tokens.
    names = M.token_names()
    fields = [(f, r.get(f)) for f in PROSE] + [(f"checks/{k}", v) for k, v in (r.get("checks") or {}).items()]
    for f, text in fields:
        text = text or ""
        for tok in _TOKEN.findall(text):
            if tok not in names:
                E(f, f"unknown token {{{tok}}}")
        if re.search(r"\(\s*\{band\}\s*\)", text):
            E(f, "{band} renders its own brackets; write '{score}, in band {band}'")
        for m in re.finditer(r"\{score\}", text):
            if not text[m.end():].startswith(", in band {band}"):
                W(f, "write the score as '{score}, in band {band}'")

    # Outcome against the score band.
    if r.get("segments"):
        steps = outcome_steps(r)
        key = "grade" if r.get("stage") == "Published" else "decision"
        band = tally(r)["band"]["letter"]
        if steps is not None and steps > M.method()["maxOutcomeMove"]:
            E(key, f"{r.get(key)!r} is {steps} steps from band {band}; at most one step is allowed")
        elif steps:
            W(key, f"{r.get(key)!r} is moved one step from band {band}; the basis must say why")

    if r.get("stage") == "Published" and not any((r.get("publication") or {}).values()):
        W("publication", "published translation with no publication details")
    return out


def validate_report(r: dict, *, text: str | None = None, stem: str | None = None) -> list[Issue]:
    """All issues for one report. Pass the file text to check canonical form, the file stem to check the id."""
    issues = schema_issues(r)
    if stem is not None and r.get("id") != stem:
        issues.append(Issue("error", "id", f"{r.get('id')!r} does not match the file name {stem!r}"))
    issues += rule_issues(r)
    if text is not None:
        fixed, _ = canonical(r)
        if dumps(fixed) != text:
            issues.append(Issue("error", "", "not in canonical form; run: python -m tc_core normalize --write <file>"))
    return issues


def validate_repo(root: str | Path) -> dict[str, list[Issue]]:
    root = Path(root)
    reports = root / "reports"
    result: dict[str, list[Issue]] = {}
    index = json.loads((reports / "index.json").read_text(encoding="utf-8"))
    ids = index.get("reports", [])
    idx_issues = []
    if len(ids) != len(set(ids)):
        idx_issues.append(Issue("error", "reports", "duplicate ids in index.json"))
    files = {p.stem for p in reports.glob("*.json") if p.stem not in ("index", "_template")}
    for i in ids:
        if i not in files:
            idx_issues.append(Issue("error", "reports", f"{i!r} is listed but reports/{i}.json does not exist"))
    for f in sorted(files - set(ids)):
        idx_issues.append(Issue("warning", "reports", f"reports/{f}.json is not listed, so the site does not show it"))
    result["reports/index.json"] = idx_issues

    tpl = reports / "_template.json"
    if tpl.exists():
        t = json.loads(tpl.read_text(encoding="utf-8"))
        fixed, _ = canonical(t)
        result["reports/_template.json"] = (
            [] if dumps(fixed) == tpl.read_text(encoding="utf-8")
            else [Issue("error", "", "template is not in canonical form; run normalize --write")]
        )
    for stem in sorted(files):
        p = reports / f"{stem}.json"
        text = p.read_text(encoding="utf-8")
        result[f"reports/{stem}.json"] = validate_report(json.loads(text), text=text, stem=stem)
    return result


def as_dicts(issues: list[Issue]) -> list[dict]:
    return [asdict(i) for i in issues]
