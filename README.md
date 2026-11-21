# Translation Criticism

Reader's reports on literary translations into Urdu. Each report is a JSON file in `reports/`. The site renders them as a searchable index (`index.html`) and as full reports (`report.html?id=<id>`). Urdu is set in Noto Nastaliq Urdu.

## Publishing

The site is plain static HTML and needs no build step. To publish it, go to **Settings → Pages** in the repository, choose **Deploy from a branch**, then select `main` and `/ (root)`. The site will appear at `https://aasem.github.io/translation-criticism/`.

To preview it locally, run `python3 -m http.server` in the repository folder and open `http://localhost:8000`. The pages load JSON with `fetch`, so opening the files directly from disk won't work.

## Editing a report

1. Open the report and press **Edit**. Everything becomes editable: catalogue details, passages, segment texts, each deviation's code, severity and note, the "keeps well" notes, every prose section, the work-level findings and the decision. You can also add or delete segments, deviations and findings.
2. Counts, per-100-word rates and severity colours are calculated from the deviations, so they stay consistent as you edit.
3. Your edits are saved in this browser as you type. To make them permanent, use one of these:
   - **Commit to GitHub** writes the file straight to `main`. It needs a fine-grained personal access token for this repository with *Contents: read and write*. The token is stored only in your browser.
   - **Download JSON**, then replace the file in `reports/` and commit it yourself.

You can also edit the JSON directly. Prose fields accept light markdown: `**bold**`, `*italic*`, `- ` bullet lists and blank-line paragraphs.

## Adding a report

1. Copy `reports/_template.json` to `reports/<id>.json` and fill it in.
2. Add the id to `reports/index.json`.

## Report format

| Field | Meaning |
| --- | --- |
| `id`, `title`, `subtitle`, `date` | Identity and heading |
| `author`, `work`, `passage`, `tags` | Catalogue details (all searchable) |
| `source`, `submission`, `reference` | `{language, label, translator, text}`; `reference` is optional and shown for reading only |
| `stakes` | `Standard`, `Literary` or `Canonical` |
| `decision` | One of the five steps on the decision scale |
| `lead`, `scope`, `profileSummary`, `tendencies`, `translatorProfile`, `findingsLead`, `decisionBasis`, `publisherNote` | Prose (light markdown) |
| `segments[]` | `{n, source, submission, deviations: [{code, severity, note}], keeps}` |
| `findings[]` | `{finding, severity, evidence}` |

Deviation codes A1–A6, B1–B3 and C1–C3 are defined in `assets/common.js` and explained on the Method page.
