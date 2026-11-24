# Editorial Assessments of Literary and Scientific Translation

Editorial assessment reports on literary and scientific translations into Urdu, for interested readers and publishers. Each report is a JSON file in `reports/`. The site renders them as a searchable index (`index.html`) and as full reports (`report.html?id=<id>`). Urdu is set in Amiri.

## Publishing

The site is plain static HTML and needs no build step. To publish it, go to **Settings → Pages** in the repository, choose **Deploy from a branch**, then select `main` and `/ (root)`. The site will appear at `https://aasem.github.io/translation-criticism/`.

To preview it locally, run `python3 -m http.server` in the repository folder and open `http://localhost:8000`. The pages load JSON with `fetch`, so opening the files directly from disk won't work.

## Editing a report

1. Open the report and press **Edit**. Everything becomes editable: catalogue details, passages, segment texts, each deviation's code, severity, note, function test and gain, the human suggestions, every prose section and the decision or grade. You can also add or delete segments and deviations.
2. Counts, per-100-word rates and severity colours are calculated from the deviations, so they stay consistent as you edit.
3. Your edits are saved in this browser as you type. To make them permanent, use one of these:
   - **Commit to GitHub** writes the file straight to `main`. It needs a fine-grained personal access token for this repository with *Contents: read and write*. The token is stored only in your browser.
   - **Download JSON**, then replace the file in `reports/` and commit it yourself.

Prose sections (lead, notes on the texts, profile, tendencies, translator profile, decision basis, publisher's note) are edited as formatted text, with **B**, *I* and list buttons (or Ctrl+B and Ctrl+I). They are stored as light markdown: `**bold**`, `*italic*`, `- ` bullet lists and blank-line paragraphs. You can also edit the JSON directly.

### Live figures in prose

Write a token in braces and the page fills in the current figure, so the prose always matches the count table:

| Token | Figure |
| --- | --- |
| `{total}` | all deviations |
| `{critical}`, `{major}`, `{minor}` | deviations of that severity |
| `{severe}` | major + critical |
| `{per100}` | deviations per 100 source words |
| `{words}`, `{segments}` | source words, segments |
| `{penalty}`, `{pp100}`, `{score}`, `{band}` | weighted penalty (Minor 1, Major 5, Critical 25), per 100 words, quality score, grade band |
| `{clean}`, `{cleanPct}` | segments without deviation, and their percentage |
| `{severeSegs}`, `{severePct}` | segments with at least one major or critical deviation, and their percentage |
| `{A}`, `{B}`, `{C}` | totals for each code family |
| `{neutral}` | neutral (unscored) deviations |
| `{aiSugg}`, `{agree}`, `{differ}`, `{unreviewed}` | AI suggestions, and how the assessor reviewed them |
| `{A1}`, `{C3}`, … | total for a single code |

Figures that don't come from the deviations (for example, semicolons per 100 words) are ordinary text and have to be updated by hand.

## Two kinds of report

A **pre-publication** report assesses a draft for a publisher and ends in an editorial decision. A **published** report assesses a translation in print, records its publication details, and ends in a grade from A to D, banded by weighted penalty points per 100 source words. The method is the same for both; the Method page sets out the scales and the sample assumption.

## Adding a report

1. Copy `reports/_template.json` to `reports/<id>.json` and fill it in.
2. Add the id to `reports/index.json`.
3. Run `python -m tc_core normalize --write reports/<id>.json`, then `python -m tc_core validate`. Fix every error before committing. Warnings are for the assessor to judge and never block.

## Method, schema and core

The method and its enforcement live in one place, `core/`, a small Python package (`tc_core`) that the site, the skill and any future service share:

| File | Role |
| --- | --- |
| `core/tc_core/method.json` | The method as data: codes, severities and weights, grade bands, decisions and their default bands, stages, text types, review states, proximity settings, tokens. The single source of truth |
| `core/tc_core/schema/report.schema.json` | The strict report format (JSON Schema 2020-12). Every field is required and has a default; unknown fields are errors |
| `core/tc_core/normalize.py` | Canonical form: upgrades older reports, fills every missing field from the schema, fixes key order |
| `core/tc_core/scoring.py` | Counts, penalty, quality score, band, spread, proximity and mimicry: the reference implementation |
| `core/tc_core/validate.py` | The schema plus the rules a schema can't express (segments rebuild the passages, merges, compensation, AI suggestions, semicolons, tokens, outcome within one step of the band, canonical form) |
| `assets/method.js` | Generated from the two JSON files for the site (`python -m tc_core build-js`). Never edit it by hand |

The site's editor saves in the same canonical form, so a report edited in the browser and one written by the skill or by code come out identical. The tests check that the browser (`assets/common.js`) and the core compute the same figures, word counts and canonical JSON for every report. The GitHub Action in `.github/workflows/validate.yml` runs the validator and the tests on every push, including commits made from the site's editor.

```
pip install -e "core[test]"
python -m tc_core validate              # every report; exits 1 on errors
python -m tc_core normalize FILE --write
python -m tc_core score FILE            # summary as JSON
python -m tc_core build-js              # after changing method.json or the schema
pytest core/tests
```

To change the method, edit `method.json` (and the schema if the format changes), run `build-js`, then re-run every report under the new method.

## Report format (schema 2)

| Field | Meaning |
| --- | --- |
| `schema` | Format version, `2` |
| `id`, `title`, `subtitle`, `date` | Identity and heading; `id` is the file name, `date` is YYYY-MM-DD |
| `author`, `work`, `originalWork`, `passage`, `tags` | Catalogue details (all searchable); `work` is the title shown on cards, `originalWork` the title in the original language |
| `source`, `submission` | `{language, label, translator, text}` |
| `stage` | `Pre-publication` (a draft; ends in an editorial decision) or `Published` (in print; ends in a grade) |
| `textType` | `Expressive` (literary: form and register count) or `Informative` (scientific, technical: style codes only where content changes) |
| `sampleLocation` | Where the sample comes from, e.g. "closing pages of Swann's Way" |
| `publication` | `{publisher, place, year, edition, isbn, pages}`; filled for published translations, empty strings otherwise |
| `decision`, `decisionBasis`, `publisherNote` | Pre-publication: one of the four steps on the decision scale (`Accept`, `Accept with minor revisions`, `Major revisions`, `Retranslation required`), and its reasoning. Empty for published reports |
| `grade`, `gradeBasis`, `readerNote` | Published: `A`–`D`, and its reasoning. Empty for drafts |
| `lead` | Conclusions: three short paragraphs on Accuracy, Language and Style, for a general reader |
| `profileSummary`, `tendencies`, `translatorProfile` | Prose (light markdown) |
| `proximity` | `{sentences, clauses, grammar, punctuation, culture}`, each `{kept, total, forced, note, forcedNote}`, counted within the pair. Proximity = kept ÷ total (descriptive, shown in the table). Structural mimicry (ہیئتی نقالی) = forced ÷ kept, the assessor's mark of kept form that goes against Urdu syntax, punctuation or idiom; its average is the plotted axis. `forced` is `null` until marked. A component with fewer than 3 cases (3 kept cases, for mimicry) is shown but not averaged. The mechanical-mimicry corner (`proximity.mimicThreshold` in `method.json`) stays unset until a threshold is chosen. Never scored |
| `checks` | `{source, paratext}`: optional assessor's notes, shown in Details. Never scored |
| `textNotes` | Report-specific notes on the texts only (transcription, misprints, segmentation). Everything general is on the Method page |
| `aiSuggestions` | `{model, date}` of the AI suggestions |
| `segments[]` | `{n, source, submission, mergedInto, deviations, suggestion}`. `n` runs 1, 2, 3…; the segment texts joined must equal the passages. `mergedInto` is the earlier segment whose target sentence also renders this source sentence (its `submission` is then empty), otherwise `null` |
| `deviations[]` | `{code, severity, note, functions, gain, compensatedBy}`. Severity is Critical, Major, Minor or Neutral (weight 0). `functions` is the function test `[{fn, kept}]`; `gain` is what a transposition adds (never scored); `compensatedBy` is the segment that makes good a Neutral loss, otherwise `null` |
| `suggestion` | `{ai, state, human}`. An AI rendering for every segment with a deviation and only for those. The second suggestion column is Asim Bakhshi's; `state` is `Not reviewed`, `Agrees with AI` or `Own suggestion`; the AI text is kept as generated |

Deviation codes A1–A7, B1–B3 and C1–C5 are defined in `core/tc_core/method.json` and explained on the Method page. C4 (Interference) is a pattern reported under Stylistic tendencies and is never recorded on a segment.

## Comparisons

A comparison lines up two or more reports of the same source passage (`compare.html?id=<id>`). It never re-scores anything: each translation keeps its own report, scored only against the source, and the comparison reads every figure from those reports.

- **Files.** `comparisons/<id>.json` lists the member reports and holds the comparative prose; `comparisons/index.json` lists the comparisons; `comparisons/_template.json` is the starting point. The format is `core/tc_core/schema/comparison.schema.json`.
- **Same segmentation.** All members must share the source passage and its segmentation. When a translation already has a report on the site, its segments are reused and new translations are aligned onto them; earlier reports are never re-segmented. The validator rejects members that differ.
- **What the page shows.** Conclusions, a summary table (outcome, score and band, A · B · C, critical · major, segments with the lowest penalty, proximity, structural mimicry), every member on one grid, the segments side by side (two translations in columns, three or more stacked) with each segment's weighted penalty and the lowest, the hard segments (a scored deviation in every translation, with the codes all share), comparative tendencies, the preferred translation, and links to the separate reports. Each member report links back to its comparisons.
- **Preferred translation.** `preferred` names a member. It starts from the highest score; another member may be preferred only if it is in the same band as the highest, with the reason in `preferredBasis` (the validator rejects anything else and warns on a move within the band). `note` is one line for readers and publishers.
- **Consistency.** Where the same code appears at the same segment in several translations with different severities, the validator warns, so the assessor can check that the departures really differ.
- **Live figures.** Comparative prose takes `{segments}`, `{words}`, `{members}`, `{hard}`, `{ties}`, and per member (numbered from 1 in the order of `members`) `{score.N}`, `{band.N}`, `{total.N}`, `{severe.N}`, `{penalty.N}`, `{pp100.N}`, `{A.N}`, `{B.N}`, `{C.N}`, `{wins.N}`. Write a score as `{score.1}, in band {band.1}`.
- **Command line.** `python -m tc_core compare <id>` prints the analysis as JSON; `python -m tc_core validate` checks comparisons with the reports.

Comparisons are edited as JSON (on GitHub or locally); the browser editor covers reports only.

## Urdu interface

Every page has an English / اردو switch in the header. The choice is remembered in the browser, and `?lang=ur` or `?lang=en` in an address sets it too. The interface strings (headings, labels, the Method page, scoring sentences, codes, decisions and grades) are in `assets/strings.js` as `[English, Urdu]` pairs; edit the Urdu there. In the pages, elements marked `data-i18n="key"` take their Urdu from that file, and `{name}` in a string is filled in by the site.

A report's own prose (conclusions, tendencies, basis and notes) is shown as written in its JSON, in either interface language.

## Licence

© 2026 Asim Bakhshi. The reports and the site's writing are licensed under [CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/): they may be quoted and shared unchanged, for non-commercial purposes, with attribution. The code and design are not licensed for reuse: you may read them, but not copy them or publish a site built from them without permission. Quoted source texts and translations remain the copyright of their authors, translators and publishers. See [LICENSE](LICENSE) for the full terms.
