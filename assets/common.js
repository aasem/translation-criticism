// Shared helpers for the translation-criticism site.
// Reports live as JSON in /reports; this file renders them.

export const CODES = {
  A1: ['Mistranslation', "The sense differs from the source's (a word's meaning, a changed subject or referent)"],
  A2: ['Addition', "Says something the source doesn't"],
  A3: ['Omission', 'Drops something the source says'],
  A4: ['Grammatical meaning', 'Tense, aspect, mood, modality or number changed'],
  A5: ['Distinction', 'Two source words merged into one target word, or one split into two that diverge'],
  A6: ['Logic', 'The relation between clauses changed'],
  B1: ['Grammar', 'Agreement, gender, case or syntax error'],
  B2: ['Non-word or spelling', 'Not a word of the target language, or misspelt'],
  B3: ['Ambiguity', "Allows a reading the source doesn't"],
  C1: ['Register', 'More formal, colloquial, religious or technical than the source'],
  C2: ['Word choice', 'Right basic meaning, wrong connotation or collocation'],
  C3: ['Imagery', 'A metaphor, simile or image altered or weakened'],
  C4: ['Interference', 'Source syntax, punctuation or calques showing through (reported as a pattern under Stylistic tendencies)'],
};

export const SEVERITIES = ['Critical', 'Major', 'Minor'];

export const DECISIONS = [
  ['Accept', 'Publish as it is.'],
  ['Accept with minor revisions', 'A copy-editor can resolve the issues.'],
  ['Major revisions', 'The draft is sound, and the same translator can revise it into shape.'],
  ['Reject and resubmit', "The draft can't be revised into shape because the problem is its method, not its slips. A fresh translation could succeed, and the same translator is welcome to resubmit one."],
  ['Reject', 'A new translation is needed, and the evidence points to a different translator.'],
];

export const ACK = 'Any translation can be reworked. This decision concerns the submitted draft, not the possibility of a good translation of this work.';

export const sevClass = (s) => ({ Critical: 'sev-critical', Major: 'sev-major', Minor: 'sev-minor' }[s] || 'sev-none');
export const decisionClass = (d) =>
  ({ Accept: 'sev-none', 'Accept with minor revisions': 'sev-minor', 'Major revisions': 'sev-major' }[d] || 'sev-critical');

export function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// Wrap runs of Arabic-script text so they get Noto Nastaliq Urdu and RTL direction.
const AR = '؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿';
const RUN = new RegExp(`[${AR}](?:[${AR}\\s…،؛؟۔.,:!()"'-]*[${AR}؟۔])?`, 'g');
export function urduWrap(html) {
  // Only touch text outside tags.
  return html.replace(/(<[^>]+>)|([^<]+)/g, (m, tag, text) =>
    tag ? tag : text.replace(RUN, (r) => `<span class="ur" lang="ur" dir="rtl">${r}</span>`)
  );
}

// Minimal markdown: paragraphs, "- " bullets, **bold**, *italic*, \_ escapes.
export function md(src) {
  if (!src) return '';
  const inline = (t) => {
    let h = esc(t).replace(/\\_/g, '\u0000');
    h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<em>$2</em>');
    return h.replace(/\u0000/g, '_');
  };
  const blocks = src.trim().split(/\n{2,}/);
  const out = blocks.map((b) => {
    const lines = b.split('\n');
    if (lines.every((l) => /^- /.test(l))) return '<ul>' + lines.map((l) => `<li>${inline(l.slice(2))}</li>`).join('') + '</ul>';
    return `<p>${inline(lines.join(' '))}</p>`;
  });
  return urduWrap(out.join(''));
}

// Words = whitespace-separated tokens containing a letter or digit (so a lone dash is not counted).
export const words = (t) => (String(t || '').match(/\S+/g) || []).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

export function tally(report) {
  const t = {};
  const total = { Critical: 0, Major: 0, Minor: 0 };
  for (const s of report.segments || [])
    for (const d of s.deviations || []) {
      t[d.code] ??= { Critical: 0, Major: 0, Minor: 0 };
      t[d.code][d.severity] = (t[d.code][d.severity] || 0) + 1;
      total[d.severity] = (total[d.severity] || 0) + 1;
    }
  const n = total.Critical + total.Major + total.Minor;
  const w = words(report.source?.text);
  return { byCode: t, total, n, words: w, per100: (x) => (w ? ((100 * x) / w).toFixed(1) : '–') };
}

export const worst = (devs) => {
  for (const s of SEVERITIES) if ((devs || []).some((d) => d.severity === s)) return s;
  return null;
};

export async function loadJSON(url) {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}

export const REPO = 'aasem/translation-criticism';
export const BRANCH = 'main';
