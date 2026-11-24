"""Tests for tc_core. Run from the repository root: pytest core/tests"""
import copy
import json
import shutil
import subprocess
from pathlib import Path

import pytest

from tc_core import canonical, dumps, figures, proximity, tally, validate_repo, validate_report, words
from tc_core import spec as M
from tc_core.__main__ import js_module
from tc_core.scoring import fixed

ROOT = Path(__file__).resolve().parents[2]
REPORTS = sorted(p for p in (ROOT / "reports").glob("*.json") if p.stem not in ("index", "_template"))
NODE = shutil.which("node")


def js(op, payload):
    out = subprocess.run([NODE, str(Path(__file__).with_name("js_eval.mjs"))], input=json.dumps({"op": op, "input": payload}),
                         capture_output=True, text=True, check=True, cwd=ROOT)
    return json.loads(out.stdout)


def load(p):
    return json.loads(p.read_text(encoding="utf-8"))


# ---- the method is defined once ----

def test_method_js_is_generated_from_method_json():
    assert (ROOT / "assets" / "method.js").read_text(encoding="utf-8") == js_module(), "run: python -m tc_core build-js"


def test_schema_enums_follow_method():
    d = M.report_schema()["$defs"]
    assert d["deviation"]["properties"]["code"]["enum"] == M.segment_codes()
    assert d["deviation"]["properties"]["severity"]["enum"] == M.severities()
    assert d["segment"]["properties"]["suggestion"]["properties"]["state"]["enum"] == M.method()["reviewStates"]
    p = M.report_schema()["properties"]
    assert p["grade"]["enum"] == M.grade_letters() + [""]
    assert p["decision"]["enum"] == M.decision_keys() + [""]
    assert p["stage"]["enum"] == M.method()["stages"]
    assert list(p["proximity"]["properties"]) == M.method()["proximity"]["keys"]


def test_every_decision_has_one_band():
    assert sorted(d["band"] for d in M.decisions()) == sorted(M.grade_letters())


# ---- the repository is valid ----

def test_repository_has_no_errors():
    res = validate_repo(ROOT)
    errors = [f"{f}: {i}" for f, xs in res.items() for i in xs if i.level == "error"]
    assert not errors, "\n".join(errors)


# ---- browser and Python agree ----

needs_node = pytest.mark.skipif(not NODE, reason="node not installed")


@needs_node
def test_figures_match_the_site():
    rs = [load(p) for p in REPORTS]
    for p, r, j in zip(REPORTS, rs, js("figures", rs)):
        f = figures(r)
        assert {k: str(v) for k, v in f.items()} == {k: str(j["figures"][k]) for k in f}, p.name
        t, pr = tally(r), proximity(r)
        assert t["band"]["letter"] == j["band"], p.name
        assert t["pp100"] == pytest.approx(j["pp100"]) and t["score"] == pytest.approx(j["score"]), p.name
        assert pr["score"] == pytest.approx(j["proximity"]) and pr["mimicry"] == pytest.approx(j["mimicry"]), p.name


@needs_node
def test_normalize_matches_the_site():
    lenient = {"stage": "Published", "segments": [{"source": "A.", "submission": "(merged into #1)", "deviations": [
        {"code": "A3", "severity": "Minor", "note": "x", "compensatedBy": ""}]}], "decision": "Accept", "extra": 1}
    rs = [load(p) for p in REPORTS] + [lenient, {}]
    assert js("normalize", rs) == [dumps(canonical(r)[0]) for r in rs]


@needs_node
def test_word_count_matches_the_site():
    samples = ["one two — three", "یہ ایک جملہ ہے۔", "a b﻿c", "‘quoted’ — (x) …", "۱۲۳ 45", "", "x y"]
    assert js("words", samples) == [words(s) for s in samples]


def test_fixed_rounds_like_tofixed():
    assert [fixed(x) for x in (1.25, 2.5, 0.05, 81.15, 99.95)] == ["1.3", "2.5", "0.1", "81.2", "100.0"]


# ---- canonical form ----

@pytest.mark.parametrize("p", REPORTS + [ROOT / "reports" / "_template.json"], ids=lambda p: p.name)
def test_files_are_canonical(p):
    assert dumps(canonical(load(p))[0]) == p.read_text(encoding="utf-8")


def test_upgrade_moves_merge_marker():
    r, notes = canonical({"schema": 1, "segments": [{"n": 2, "submission": "(merged into #1)"}]})
    assert r["segments"][0]["mergedInto"] == 1 and r["segments"][0]["submission"] == "" and r["schema"] == 2


# ---- the validator catches mistakes ----

BASE = REPORTS[0]


def broken(mutate):
    r = load(BASE)
    mutate(r)
    return [i for i in validate_report(r) if i.level == "error"]


def first_dev_seg(r):
    return next(s for s in r["segments"] if s["deviations"])


MUTATIONS = {
    "unknown code": lambda r: first_dev_seg(r)["deviations"][0].update(code="Z9"),
    "pattern code on a segment": lambda r: first_dev_seg(r)["deviations"][0].update(code="C4"),
    "unknown severity": lambda r: first_dev_seg(r)["deviations"][0].update(severity="Severe"),
    "empty note": lambda r: first_dev_seg(r)["deviations"][0].update(note=""),
    "semicolon in AI suggestion": lambda r: first_dev_seg(r)["suggestion"].update(ai="ایک؛ دو"),
    "missing AI suggestion": lambda r: first_dev_seg(r)["suggestion"].update(ai=""),
    "segment numbering": lambda r: r["segments"][0].update(n=7),
    "segments no longer rebuild the passage": lambda r: r["segments"][0].update(source=r["segments"][0]["source"] + " extra"),
    "compensation on a scored deviation": lambda r: first_dev_seg(r)["deviations"][0].update(compensatedBy=1, severity="Major"),
    "unknown token": lambda r: r.update(lead=r["lead"] + " {scroe}"),
    "band in brackets": lambda r: r.update(lead=r["lead"] + " {score} ({band})"),
    "unknown field": lambda r: r.update(findings="x"),
    "decision on a published report": lambda r: r.update(decision="Accept"),
    "grade two steps from band": lambda r: r.update(grade="B") if r["stage"] == "Published" else r.update(decision="Accept with minor revisions"),
    "forced exceeds kept": lambda r: r["proximity"]["sentences"].update(kept=1, total=4, forced=3),
    "bad date": lambda r: r.update(date="22 Nov 2026"),
    "merge pointing forward": lambda r: r["segments"][0].update(mergedInto=5, submission=""),
}


@pytest.mark.parametrize("name", MUTATIONS)
def test_validator_rejects(name):
    assert broken(MUTATIONS[name]), f"validator accepted: {name}"


def test_base_report_is_valid():
    assert not broken(lambda r: None)
