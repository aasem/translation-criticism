"""Urdu twins: fields named in method.json['urduTwins'] have a sibling '<name>Ur'.

localize(doc, 'ur') returns a copy where every filled twin replaces its English field,
which is what the Urdu page shows; missing() lists English fields whose twin is empty.
The browser mirrors localize() in assets/common.js.
"""
from __future__ import annotations

import copy

from . import spec as M


def _walk(obj, parts, fn):
    if not parts or obj is None:
        return
    head, rest = parts[0], parts[1:]
    if head == "*":
        items = obj.values() if isinstance(obj, dict) else obj if isinstance(obj, list) else []
        for x in items:
            _walk(x, rest, fn)
    elif not rest:
        if isinstance(obj, dict):
            fn(obj, head)
    elif isinstance(obj, dict):
        _walk(obj.get(head), rest, fn)


def twins(kind: str = "report") -> list[str]:
    return M.method()["urduTwins"][kind]


def localize(doc: dict, lang: str = "ur", kind: str = "report") -> dict:
    out = copy.deepcopy(doc)
    if lang != "ur":
        return out

    def sub(o, k):
        v = o.get(k + "Ur")
        if isinstance(v, str) and v.strip():
            o[k] = v

    for p in twins(kind):
        _walk(out, p.split("."), sub)
    return out


def missing(doc: dict, kind: str = "report") -> list[str]:
    """English fields with text whose Urdu twin is empty."""
    found: list[str] = []
    for p in twins(kind):
        def chk(o, k, p=p):
            if (o.get(k) or "").strip() and not (o.get(k + "Ur") or "").strip():
                found.append(p)
        _walk(doc, p.split("."), chk)
    return found
