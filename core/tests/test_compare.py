"""Comparison layer: browser/Python parity and the rules. Fixtures are built in memory
from a real report (variants with other severities), so nothing fictitious is published."""
import copy
import json
import shutil
import subprocess
from pathlib import Path

import pytest

from tc_core import analyse, canonical, comparison_figures, consistency, dumps, normalize_comparison, validate_comparison
from tc_core.scoring import tally

ROOT = Path(__file__).resolve().parents[2]
NODE = shutil.which("node")
BASE = canonical(json.loads((ROOT / "reports" / "proust-swann-madeleine-urdu-unnamed.json").read_text(encoding="utf-8")))[0]


def variant(rid, translator, fn):
    r = copy.deepcopy(BASE)
    r["id"], r["submission"]["translator"] = rid, translator
    for s in r["segments"]:
        fn(s)
        if not s["deviations"]:
            s["suggestion"] = {"ai": "", "state": "Not reviewed", "human": ""}
    return r


def softer(s):  # every Major/Critical becomes Minor
    for d in s["deviations"]:
        if d["severity"] in ("Major", "Critical"):
            d["severity"] = "Minor"


def cleaner(s):  # drops the first deviation of each segment
    s["deviations"] = s["deviations"][1:]


A = BASE
B = variant("proust-test-b", "Test Translator B", softer)
C = variant("proust-test-c", "Test Translator C", cleaner)
BY_ID = {r["id"]: r for r in (A, B, C)}


def cmp(*ids, preferred=None, **kw):
    c = {"id": "test-compare", "title": "Test", "subtitle": "Test", "date": "2026-11-24", "author": "Proust", "work": "Swann's Way",
         "members": [{"id": i, "label": ""} for i in ids], "preferred": preferred or ids[0], **kw}
    return normalize_comparison(c)


def errors(c):
    return [i for i in validate_comparison(c, BY_ID) if i.level == "error"]


def warnings(c):
    return [i for i in validate_comparison(c, BY_ID) if i.level == "warning"]


def js(op, payload):
    out = subprocess.run([NODE, str(Path(__file__).with_name("js_eval.mjs"))], input=json.dumps({"op": op, "input": payload}),
                         capture_output=True, text=True, check=True, cwd=ROOT)
    return json.loads(out.stdout)


def best(*rs):
    return max(rs, key=lambda r: tally(r)["score"])["id"]


@pytest.mark.skipif(not NODE, reason="node not installed")
@pytest.mark.parametrize("ids", [(A["id"], B["id"]), (A["id"], B["id"], C["id"])], ids=["two", "three"])
def test_analysis_matches_the_site(ids):
    c, rs = cmp(*ids), [BY_ID[i] for i in ids]
    j = js("analyse", [{"cmp": c, "reports": rs}])[0]
    py = analyse(c, rs)
    assert j["a"]["segments"] == py["segments"] and j["a"]["hard"] == py["hard"] and j["a"]["ties"] == py["ties"]
    for x, y in zip(j["a"]["members"], py["members"]):
        assert x["label"] == y["label"] and x["wins"] == y["wins"] and x["band"] == y["band"]
        assert x["score"] == pytest.approx(y["score"])
    assert {k: str(v) for k, v in comparison_figures(c, rs).items()} == {k: str(v) for k, v in j["f"].items()}


@pytest.mark.skipif(not NODE, reason="node not installed")
def test_normalize_comparison_matches_the_site():
    cs = [cmp(A["id"], B["id"]), {"members": [{"id": "x"}], "extra": 1}, {}]
    assert js("normalizeComparison", cs) == [dumps(normalize_comparison(c)) for c in cs]


def test_lowest_and_wins_add_up():
    a = analyse(cmp(A["id"], B["id"], C["id"]), [A, B, C])
    for s in a["segments"]:
        assert s["tie"] == (len(s["lowest"]) == 3)
        assert all(s["penalties"][k] == min(s["penalties"]) for k in s["lowest"])
    assert sum(m["wins"] for m in a["members"]) == sum(len(s["lowest"]) for s in a["segments"] if not s["tie"])


def test_highest_score_preferred_is_clean():
    c = cmp(A["id"], B["id"], C["id"], preferred=best(A, B, C))
    assert not errors(c)


def test_preference_outside_the_top_band_is_rejected():
    ranked = sorted((A, B, C), key=lambda r: tally(r)["score"])
    low, top = ranked[0], ranked[-1]
    assert tally(low)["band"]["letter"] != tally(top)["band"]["letter"], "fixture needs two bands"
    assert any(i.path == "preferred" for i in errors(cmp(A["id"], B["id"], C["id"], preferred=low["id"])))


def test_preference_within_the_band_is_a_warning():
    a2 = variant("proust-test-a2", "Test A2", lambda s: None)
    seg = next(s for s in a2["segments"] if len(s["deviations"]) > 1 and any(d["severity"] == "Minor" for d in s["deviations"]))
    seg["deviations"].remove(next(d for d in seg["deviations"] if d["severity"] == "Minor"))  # one Minor fewer, same band
    BY_ID[a2["id"]] = a2
    hi, lo = sorted((A, a2), key=lambda r: tally(r)["score"])[::-1]
    if tally(hi)["score"] == tally(lo)["score"]:
        pytest.skip("no score difference in fixture")
    c = cmp(A["id"], a2["id"], preferred=lo["id"])
    assert not errors(c) and any(i.path == "preferred" for i in warnings(c))


def test_consistency_flags_same_code_different_severity():
    found = consistency(cmp(A["id"], B["id"]), [A, B])
    assert found and all(len(set().union(*map(set, x["severities"].values()))) > 1 for x in found)


@pytest.mark.parametrize("name,c", [
    ("unknown member", lambda: cmp(A["id"], "no-such-report")),
    ("listed twice", lambda: cmp(A["id"], A["id"])),
    ("one member", lambda: normalize_comparison({**cmp(A["id"], B["id"]), "members": [{"id": A["id"], "label": ""}]})),
    ("preferred not a member", lambda: cmp(A["id"], B["id"], preferred="dickens-two-cities-opening-urdu-rahman")),
    ("unknown token", lambda: cmp(A["id"], B["id"], preferred=best(A, B), lead="{score.3}, in band {band.3}")),
    ("unknown field", lambda: {**cmp(A["id"], B["id"], preferred=best(A, B)), "verdict": "x"}),
])
def test_rejected(name, c):
    assert errors(c()), name


def test_different_sentences_are_rejected():
    d = copy.deepcopy(B)
    d["id"] = "proust-test-d"
    for s in d["segments"][2:]:  # sentence 2 joined to sentence 1
        s["sentence"] -= 1
    BY_ID[d["id"]] = d
    assert any("sentence" in i.message for i in errors(cmp(A["id"], d["id"], preferred=best(A, d))))


def test_different_rows_within_the_same_sentences_are_fine():
    d = copy.deepcopy(B)
    d["id"] = "proust-test-e"
    first, second = d["segments"][0], d["segments"][1]
    assert first["sentence"] == second["sentence"]  # 1.1 and 1.2 in the Madeleine report
    first["source"] += " " + second["source"]
    first["submission"] += " " + second["submission"]
    first["deviations"] += second["deviations"]
    first["suggestion"]["ai"] = (first["suggestion"]["ai"] + " " + second["suggestion"]["ai"]).strip()
    del d["segments"][1]
    for i, s in enumerate(d["segments"]):
        s["n"] = i + 1
    BY_ID[d["id"]] = d
    c = cmp(A["id"], d["id"], preferred=best(A, d))
    assert not [i for i in errors(c) if i.path == "members"]
    a = analyse(c, [A, d])
    assert len(a["segments"]) == 13 and a["members"][1]["score"] == pytest.approx(tally(B)["score"])


def test_tokens_fill():
    f = comparison_figures(cmp(A["id"], B["id"]), [A, B])
    assert f["members"] == 2 and "score.2" in f and "wins.1" in f and "band.2" in f
