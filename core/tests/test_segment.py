"""Segmentation rule sentence-v1: deterministic, lossless, and enforced by the validator."""
import copy
import json
import re
from pathlib import Path

import pytest

from tc_core import canonical, validate_report
from tc_core.segment import departures, segment, sentences

ROOT = Path(__file__).resolve().parents[2]
sq = lambda s: re.sub(r"\s+", "", s)


@pytest.mark.parametrize("text,expected", [
    ("It was late. She left.", ["It was late.", "She left."]),
    ("Mme. Swann walked. Then rain.", ["Mme. Swann walked.", "Then rain."]),
    ("Was it? I dare say.", ["Was it?", "I dare say."]),
    ("“Go!” He went.", ["“Go!”", "He went."]),
    ("He said “go!” and went.", ["He said “go!” and went."]),
    ("Wait… then nothing. End", ["Wait… then nothing.", "End"]),
    ("See vol. 2 and pp. 3. Done.", ["See vol. 2 and pp. 3.", "Done."]),
    ("A sentence of three hundred words " + "and so on, " * 120 + "ends here.", None),
])
def test_sentences(text, expected):
    got = sentences(text)
    assert sq("".join(got)) == sq(text)
    if expected is None:
        assert len(got) == 1  # no length cap
    else:
        assert got == expected


@pytest.mark.parametrize("p", sorted((ROOT / "reports").glob("*-*.json")), ids=lambda p: p.stem)
def test_segment_is_lossless_and_stable(p):
    text = json.loads(p.read_text(encoding="utf-8"))["source"]["text"]
    a, b = segment(text), segment(text)
    assert a == b and sq("".join(a)) == sq(text)


BASE = canonical(json.loads((ROOT / "reports" / "proust-swann-madeleine-urdu-unnamed.json").read_text(encoding="utf-8")))[0]


def errs(r):
    return [i for i in validate_report(r) if i.level == "error" and i.path.startswith("segmentation")]


def test_held_reports_declare_their_departures():
    assert departures(BASE)["split"] and BASE["segmentation"]["exceptions"]
    assert not errs(BASE)


def test_undeclared_departure_is_an_error():
    r = copy.deepcopy(BASE)
    r["segmentation"]["exceptions"] = ""
    assert errs(r)


def test_report_following_the_rule_needs_no_exceptions():
    r = copy.deepcopy(BASE)
    segs = segment(r["source"]["text"])
    r["segments"] = [{"n": i + 1, "source": s, "submission": "x", "mergedInto": None, "deviations": [],
                      "suggestion": {"ai": "", "state": "Not reviewed", "human": ""}} for i, s in enumerate(segs)]
    r["submission"]["text"] = "x" * len(segs)
    r["segmentation"]["exceptions"] = ""
    assert departures(r) == {"split": [], "joined": [], "rule": len(segs), "held": len(segs)}
    assert not errs(r)
