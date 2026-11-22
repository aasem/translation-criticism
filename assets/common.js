// Shared helpers for the translation-criticism site.
// Reports live as JSON in /reports; this file renders them.
import { t, UR } from './i18n.js';

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
if (UR) for (const c in CODES) CODES[c] = [t(`code.${c}`), t(`code.${c}.t`)];

export const SEVERITIES = ['Critical', 'Major', 'Minor', 'Neutral'];
// Penalised severities. Neutral (MQM's zero-weight level) records a deliberate transposition
// or a compensated loss: it is shown and counted separately, and never enters the score.
export const SCORED = ['Critical', 'Major', 'Minor'];
export const FINDING_SEVERITIES = SCORED;
// Human review of the AI suggestion for a segment.
export const REVIEW = ['Not reviewed', 'Agrees with AI', 'Own suggestion'];

export const DECISIONS = [
  ['Accept', 'Publish as it is.'],
  ['Accept with minor revisions', 'A copy-editor can resolve the issues.'],
  ['Major revisions', 'The draft is sound, and the same translator can revise it into shape.'],
  ['Retranslation required', "The deviations are too many or too deep to revise. The work must be translated afresh."],
];
// The first item is the value stored in reports; only the meaning is shown translated here.
// Use label('decision', d) from i18n.js to show a decision's name.
if (UR) for (const d of DECISIONS) d[1] = t(`decision.${d[0]}.m`);

export const ACK = UR ? t('ack.draft') : 'Any translation can be reworked. This decision concerns the submitted draft, not the possibility of a good translation of this work.';
export const ACK_PUBLISHED = UR ? t('ack.published') : 'Any translation can be reworked. This grade concerns the published translation as sampled here, not the possibility of a good translation of this work.';

// Two kinds of assessment: a draft before publication (editorial decision for a publisher)
// and a translation already in print (grade for readers).
export const STAGES = ['Pre-publication', 'Published'];
export const isPublished = (r) => r.stage === 'Published';

// MQM severity weights, as in MQM 2.0 scoring.
export const WEIGHTS = { Neutral: 0, Minor: 1, Major: 5, Critical: 25 };

// Grades for published translations, by weighted penalty points per 100 source words.
export const GRADES = [
  ['A', 'Exemplary', 2, 'A faithful literary equivalent. Deviations are rare and slight.'],
  ['B', 'Sound', 5, 'Reliable throughout. Deviations are mostly minor and do not distort the work.'],
  ['C', 'Serviceable', 10, 'Conveys the work, but readers meet recurring losses of sense, image or tone.'],
  ['D', 'Deficient', Infinity, 'Frequent or serious deviations. Readers receive a distorted version of the work, which cannot be relied on to represent it.'],
];
if (UR) for (const g of GRADES) { g[1] = t(`grade.${g[0]}`); g[3] = t(`grade.${g[0]}.m`); }
export const bandFor = (pp100) => GRADES.find((g) => pp100 <= g[2]) || GRADES[GRADES.length - 1];
// The quality score is 100 minus penalty points per 100 words, so each band has a score range too.
export const scoreRange = (letter) => {
  const i = GRADES.findIndex((g) => g[0] === letter); if (i < 0) return '';
  const hi = i ? 100 - GRADES[i - 1][2] : 100, lo = GRADES[i][2] === Infinity ? null : 100 - GRADES[i][2];
  return lo === null ? t('grade.below', { max: hi }) : i ? `${lo}–${hi}` : t('grade.andAbove', { min: lo });
};

// Targets for reading a score: acceptable is band B (95+), ideal is band A (98+).
export const TARGETS = { acceptable: 'B', ideal: 'A' };
export function scoreGuide(t) {
  const lvl = (letter) => { const g = GRADES.find((x) => x[0] === letter);
    return { letter, name: g[1], score: 100 - g[2], maxPenalty: Math.floor((g[2] * t.words) / 100) }; };
  const acc = lvl(TARGETS.acceptable), ideal = lvl(TARGETS.ideal);
  const status = t.score >= ideal.score ? 'ideal' : t.score >= acc.score ? 'acceptable' : 'below';
  return { acc, ideal, status, toAcc: Math.max(0, t.penalty - acc.maxPenalty), toIdeal: Math.max(0, t.penalty - ideal.maxPenalty) };
}

// Default editorial decision for each score band. The assessor may move a draft one step off it, with the reason in the basis.
export const DECISION_ANCHOR = {
  A: ['Accept'], B: ['Accept with minor revisions'], C: ['Major revisions'], D: ['Retranslation required'],
};
export const anchorText = (letter) => (DECISION_ANCHOR[letter] || [''])[0];
// True when the outcome on record differs from the one the score band points to.
export const outcomeMoved = (r, t) => (r.stage === 'Published'
  ? !!r.grade && r.grade !== t.band[0]
  : !!r.decision && !(DECISION_ANCHOR[t.band[0]] || []).includes(r.decision));

export const gradeName = (letter) => { const g = GRADES.find((x) => x[0] === letter); return g ? `${g[0]} · ${g[1]}` : ''; };
export const gradeClass = (letter) => ({ A: 'sev-none', B: 'sev-none', C: 'sev-minor', D: 'sev-critical' }[letter] || '');

export const sevClass = (s) => ({ Critical: 'sev-critical', Major: 'sev-major', Minor: 'sev-minor', Neutral: 'sev-neutral' }[s] || 'sev-none');
export const decisionClass = (d) =>
  ({ Accept: 'sev-none', 'Accept with minor revisions': 'sev-minor', 'Major revisions': 'sev-major' }[d] || 'sev-critical');

export function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// Wrap runs of Arabic-script text so they get the Urdu font (Amiri) and RTL direction.
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
  const total = { Critical: 0, Major: 0, Minor: 0, Neutral: 0 };
  for (const s of report.segments || [])
    for (const d of s.deviations || []) {
      t[d.code] ??= { Critical: 0, Major: 0, Minor: 0, Neutral: 0 };
      t[d.code][d.severity] = (t[d.code][d.severity] || 0) + 1;
      total[d.severity] = (total[d.severity] || 0) + 1;
    }
  const n = total.Critical + total.Major + total.Minor;
  const w = words(report.source?.text);
  const penalty = total.Critical * WEIGHTS.Critical + total.Major * WEIGHTS.Major + total.Minor * WEIGHTS.Minor;
  const pp100 = w ? (100 * penalty) / w : 0;
  const score = w ? Math.max(0, 100 * (1 - penalty / w)) : 0;
  return { byCode: t, total, n, neutral: total.Neutral, words: w, penalty, pp100, score, band: bandFor(pp100),
    per100: (x) => (w ? ((100 * x) / w).toFixed(1) : '–') };
}

export const worst = (devs) => {
  for (const s of SEVERITIES) if ((devs || []).some((d) => d.severity === s)) return s; // Neutral last
  return null;
};

export async function loadJSON(url) {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}

// Line icons (24×24, stroke = currentColor).
const P = {
  book: '<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>',
  feather: '<path d="M20.2 12.2A6 6 0 0 0 11.8 3.8L5 10.6V19h8.4z"/><path d="M16 8 2 22"/><path d="M17.5 15H9"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  scale: '<path d="M12 3v18"/><path d="M5 21h14"/><path d="M3 7h18"/><path d="m6 7-3 7a3 3 0 0 0 6 0z"/><path d="m18 7-3 7a3 3 0 0 0 6 0z"/>',
  columns: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  chart: '<path d="M3 3v18h18"/><path d="M8 17V11"/><path d="M13 17V7"/><path d="M18 17v-4"/>',
  wave: '<path d="M2 12c2.5-4 5-4 7.5 0s5 4 7.5 0 3.5-3 5-2"/><path d="M2 18c2.5-4 5-4 7.5 0s5 4 7.5 0 3.5-3 5-2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  flag: '<path d="M4 22V4"/><path d="M4 4h13l-2 4 2 4H4"/>',
  gavel: '<path d="m14 13-7.5 7.5a2.1 2.1 0 0 1-3-3L11 10"/><path d="m16 16 6-6"/><path d="m8 8 6-6"/><path d="m9 7 8 8"/><path d="m21 11-8-8"/>',
  doc: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8 13h8"/><path d="M8 17h5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>',
  pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>',
  code: '<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>',
  print: '<path d="M6 9V2h12v7"/><rect x="2" y="9" width="20" height="9" rx="2"/><path d="M6 14h12v8H6z"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
  arrow: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
};
export const icon = (name, cls = '') =>
  `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;

export const REPO = 'aasem/translation-criticism';
export const BRANCH = 'main';

// ---------- live figures in prose ----------
// Tokens such as {total} or {A1} in any prose field are replaced with figures
// computed from the deviations, so the prose always matches the count table.
export const TOKENS = {
  total: 'all deviations', critical: 'critical', major: 'major', minor: 'minor',
  severe: 'major + critical', per100: 'deviations per 100 source words', words: 'source words',
  segments: 'segments', penalty: 'weighted penalty points', pp100: 'penalty points per 100 words',
  score: 'MQM quality score', band: 'grade band from the score',
  neutral: 'neutral (unscored) deviations',
  clean: 'segments without deviation', cleanPct: '% of segments without deviation',
  severeSegs: 'segments with a major or critical deviation', severePct: '% of segments with one',
  A: 'accuracy (A) codes', B: 'language (B) codes', C: 'style (C) codes',
  aiSugg: 'segments with an AI suggestion', agree: 'human agrees with AI', differ: 'human gives own suggestion', unreviewed: 'not yet reviewed',
  A1: '…and so on for any single code',
};
export function figures(report) {
  const t = tally(report);
  const f = {
    total: t.n, critical: t.total.Critical, major: t.total.Major, minor: t.total.Minor,
    severe: t.total.Critical + t.total.Major, per100: t.per100(t.n), words: t.words,
    segments: (report.segments || []).length, penalty: t.penalty, pp100: t.pp100.toFixed(1),
    score: t.score.toFixed(1), band: `${t.band[0]} (${t.band[1]})`, A: 0, B: 0, C: 0, neutral: t.neutral,
  };
  // Spread across segments: descriptive only, never part of the score or grade.
  const segs = report.segments || [];
  const pct = (n) => (segs.length ? Math.round((100 * n) / segs.length) : 0);
  const scored = (x) => (x.deviations || []).filter((d) => SCORED.includes(d.severity));
  f.clean = segs.filter((x) => !scored(x).length).length;
  f.severeSegs = segs.filter((x) => scored(x).some((d) => d.severity !== 'Minor')).length;
  const ag = agreement(report); Object.assign(f, ag);
  f.cleanPct = pct(f.clean); f.severePct = pct(f.severeSegs);
  for (const c of Object.keys(CODES)) {
    const x = t.byCode[c]; const n = x ? x.Critical + x.Major + x.Minor : 0;
    f[c] = n; f[c[0]] += n;
  }
  return f;
}
// AI and human suggestions: how often the human reviewer agrees with the AI's alternative.
export function agreement(report) {
  const withAI = (report.segments || []).filter((s) => s.suggestion?.ai?.trim());
  const st = (s) => s.suggestion?.state || 'Not reviewed';
  return { aiSugg: withAI.length, agree: withAI.filter((s) => st(s) === 'Agrees with AI').length,
    differ: withAI.filter((s) => st(s) === 'Own suggestion').length, unreviewed: withAI.filter((s) => st(s) === 'Not reviewed').length };
}
// Function test lines are stored as [{fn, kept}] and edited as "+ kept" / "- lost" lines.
export const fnToText = (a) => (a || []).map((x) => `${x.kept ? '+' : '-'} ${x.fn}`).join('\n');
export const textToFn = (s) => String(s || '').split('\n').map((l) => l.trim()).filter(Boolean)
  .map((l) => ({ kept: !l.startsWith('-'), fn: l.replace(/^[+-]\s*/, '') }));
export const fill = (text, f) => String(text ?? '').replace(/\{(\w+)\}/g, (m, k) => (k in f ? String(f[k]) : m));

// ---------- rich-text editing ----------
// Converts the edited HTML back to the light markdown the reports store:
// paragraphs, "- " bullets, **bold**, *italic*.
export function htmlToMd(root) {
  const inline = (node) => {
    let out = '';
    for (const n of node.childNodes) {
      if (n.nodeType === 3) out += n.nodeValue.replace(/ /g, ' ').replace(/_/g, '\\_');
      else if (n.nodeType === 1) {
        const tag = n.tagName;
        if (tag === 'BR') out += ' ';
        else if (tag === 'STRONG' || tag === 'B') { const s = inline(n); out += s.trim() ? `**${s.trim()}**${/\s$/.test(s) ? ' ' : ''}` : s; }
        else if (tag === 'EM' || tag === 'I') { const s = inline(n); out += s.trim() ? `*${s.trim()}*${/\s$/.test(s) ? ' ' : ''}` : s; }
        else if (tag === 'UL' || tag === 'OL' || tag === 'P' || tag === 'DIV') out += ' ' + inline(n) + ' ';
        else out += inline(n);
      }
    }
    return out;
  };
  const tidy = (s) => s.replace(/[ \t]+/g, ' ').trim();
  const blocks = [];
  let loose = '';
  const flush = () => { if (tidy(loose)) blocks.push(tidy(loose)); loose = ''; };
  for (const n of root.childNodes) {
    if (n.nodeType === 1 && (n.tagName === 'UL' || n.tagName === 'OL')) {
      flush();
      const items = [...n.children].filter((li) => li.tagName === 'LI').map((li) => tidy(inline(li))).filter(Boolean);
      if (items.length) blocks.push(items.map((i) => '- ' + i).join('\n'));
    } else if (n.nodeType === 1 && (n.tagName === 'P' || n.tagName === 'DIV')) {
      flush(); const s = tidy(inline(n)); if (s) blocks.push(s);
    } else if (n.nodeType === 1 && n.tagName === 'BR') { flush(); }
    else loose += n.nodeType === 3 ? n.nodeValue.replace(/ /g, ' ').replace(/_/g, '\\_') : inline({ childNodes: [n] });
  }
  flush();
  return blocks.join('\n\n');
}
