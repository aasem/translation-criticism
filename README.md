# Editorial Assessments of Literary and Scientific Translation

Editorial assessment reports on literary and scientific translations into Urdu, for interested readers and publishers. Each report is a JSON file in `reports/`. The site renders them as a searchable index (`index.html`) and as full reports (`report.html?id=<id>`). Urdu is set in Noto Nastaliq Urdu.

## Publishing

The site is plain static HTML and needs no build step. To publish it, go to **Settings → Pages** in the repository, choose **Deploy from a branch**, then select `main` and `/ (root)`. The site will appear at `https://aasem.github.io/translation-criticism/`.

To preview it locally, run `python3 -m http.server` in the repository folder and open `http://localhost:8000`. The pages load JSON with `fetch`, so opening the files directly from disk won't work.

## Editing a report

1. Open the report and press **Edit**. Everything becomes editable: catalogue details, passages, segment texts, each deviation's code, severity and note, the "keeps well" notes, every prose section, the work-level findings and the decision. You can also add or delete segments, deviations and findings.
2. Counts, per-100-word rates and severity colours are calculated from the deviations, so they stay consistent as you edit.
3. Your edits are saved in this browser as you type. To make them permanent, use one of these:
   - **Commit to GitHub** writes the file straight to `main`. It needs a fine-grained personal access token for this repository with *Contents: read and write*. The token is stored only in your browser.
   - **Download JSON**, then replace the file in `reports/` and commit it yourself.

Prose sections (lead, scope, profile, tendencies, translator profile, findings lead, decision basis, publisher's note) are edited as formatted text, with **B**, *I* and list buttons (or Ctrl+B and Ctrl+I). They are stored as light markdown: `**bold**`, `*italic*`, `- ` bullet lists and blank-line paragraphs. You can also edit the JSON directly.

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
| `{A1}`, `{C3}`, … | total for a single code |

Figures that don't come from the deviations (for example, semicolons per 100 words) are ordinary text and have to be updated by hand.

## Two kinds of report

A **pre-publication** report assesses a draft for a publisher and ends in an editorial decision. A **published** report assesses a translation in print, records its publication details, and ends in a grade from A to E, banded by weighted penalty points per 100 source words. The method is the same for both; the Method page sets out the scales and the sample assumption.

## Adding a report

1. Copy `reports/_template.json` to `reports/<id>.json` and fill it in.
2. Add the id to `reports/index.json`.

## Report format

| Field | Meaning |
| --- | --- |
| `id`, `title`, `subtitle`, `date` | Identity and heading |
| `author`, `work`, `originalWork`, `passage`, `tags` | Catalogue details (all searchable); `work` is the title shown on cards, `originalWork` the title in the original language |
| `source`, `submission` | `{language, label, translator, text}` |
| `reference` | `{language, translator, note, text}`: an acceptable rendering of the same sample, without the recorded deviations, shown for comparison and never assessed. Leave `text` empty and the report says none has been added |
| `stage` | `Pre-publication` (a draft; ends in an editorial decision) or `Published` (in print; ends in a grade) |
| `sampleLocation` | Where the sample comes from, e.g. "closing pages of Swann's Way" |
| `publication` | Published only: `{publisher, place, year, edition, isbn, pages}` |
| `stakes` | `Standard`, `Literary` or `Canonical` |
| `decision`, `decisionBasis`, `publisherNote` | Pre-publication: one of the five steps on the decision scale, and its reasoning |
| `grade`, `gradeBasis`, `readerNote` | Published: `A`–`E`, and its reasoning |
| `lead`, `scope`, `profileSummary`, `tendencies`, `translatorProfile`, `findingsLead` | Prose (light markdown) |
| `segments[]` | `{n, source, submission, deviations: [{code, severity, note}], keeps}` |
| `findings[]` | `{finding, severity, evidence}` |

Deviation codes A1–A6, B1–B3 and C1–C3 are defined in `assets/common.js` and explained on the Method page.

## Licence

© 2026 Asim Bakhshi. The reports and the site's writing are licensed under [CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/): they may be quoted and shared unchanged, for non-commercial purposes, with attribution. The code and design are not licensed for reuse: you may read them, but not copy them or publish a site built from them without permission. Quoted source texts and translations remain the copyright of their authors, translators and publishers. See [LICENSE](LICENSE) for the full terms.
