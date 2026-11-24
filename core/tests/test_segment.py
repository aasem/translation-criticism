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
    ("“Oh, horrible!” I exclaimed to myself. Then I left.", ["“Oh, horrible!” I exclaimed to myself.", "Then I left."]),
    ("“Why?” asked Swann. He left.", ["“Why?” asked Swann.", "He left."]),
    ("“Stop!” cried Ahab, “stop!” The men froze.", ["“Stop!” cried Ahab, “stop!”", "The men froze."]),
    ("“Could it be?” Could I ever have known?", ["“Could it be?”", "Could I ever have known?"]),
    ("“Yes.” Mme. Swann said nothing more.", ["“Yes.” Mme. Swann said nothing more."]),
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


@pytest.mark.parametrize("p", sorted((ROOT / "reports").glob("*-*.json")), ids=lambda p: p.stem)
def test_every_report_follows_the_rule(p):
    r = canonical(json.loads(p.read_text(encoding="utf-8")))[0]
    d = departures(r)
    assert not d["split"] and not d["joined"] and not r["segmentation"]["exceptions"]


def regroup(r, row, k):
    """Put row (0-based) and all later rows k sentences further on."""
    for s in r["segments"][row:]:
        s["sentence"] += k


def test_rows_split_wrongly_across_sentences_is_an_error():
    r = copy.deepcopy(BASE)
    regroup(r, 1, 1)  # row 1.2 made its own sentence: a cut inside a sentence
    assert errs(r)


def test_declared_exception_is_accepted():
    r = copy.deepcopy(BASE)
    regroup(r, 1, 1)
    r["segmentation"]["exceptions"] = "#2 is kept apart because the transcription marks a paragraph break."
    assert not errs(r)


def test_sentence_numbers_must_rise_by_one():
    r = copy.deepcopy(BASE)
    regroup(r, 3, 2)
    assert any(i.path.endswith("sentence") for i in validate_report(r) if i.level == "error")


def test_rows_within_a_sentence_change_no_figure():
    from tc_core import figures
    r = copy.deepcopy(BASE)
    seg = next(s for s in r["segments"] if len(s["source"].split()) > 12 and not s["mergedInto"])
    i = r["segments"].index(seg)
    words_ = seg["source"].split(" ")
    half = len(words_) // 2
    a, b = copy.deepcopy(seg), copy.deepcopy(seg)
    a["source"], b["source"] = " ".join(words_[:half]), " ".join(words_[half:])
    b["submission"], b["deviations"], b["mergedInto"] = "x", [], None  # a new row in the same sentence
    r["segments"][i:i + 1] = [a, b]
    for k, s in enumerate(r["segments"], start=1):
        s["n"] = k
    f0, f1 = figures(BASE), figures(r)
    for key in ("score", "segments", "clean", "severeSegs", "cleanPct", "severePct", "band"):
        assert f0[key] == f1[key], key
    assert f1["rows"] == f0["rows"] + 1
