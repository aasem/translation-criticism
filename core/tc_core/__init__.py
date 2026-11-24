"""tc_core: the assessment method, schema, scoring and validation for translation reports.

The static site, the skill and any future service (e.g. a FastAPI backend) use this
package, so the method is defined and enforced in one place.

    from tc_core import load, figures, summary, validate_report
"""
from .spec import method, report_schema
from .normalize import SCHEMA_VERSION, canonical, dumps, normalize, normalize_comparison, upgrade
from .scoring import agreement, figures, fill, proximity, summary, tally, words
from .validate import Issue, validate_repo, validate_report
from .localize import localize, missing
from .compare import analyse, consistency, validate_comparison
from .compare import figures as comparison_figures

__version__ = "2.0.0"


def load(path):
    """Read a report file and return it in canonical form."""
    import json
    from pathlib import Path
    r, _ = canonical(json.loads(Path(path).read_text(encoding="utf-8")))
    return r
