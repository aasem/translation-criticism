// Shared helpers for the translation-criticism site.
// Reports live as JSON in /reports; this file renders them.
import { t, UR } from './i18n.js';
import { METHOD, SCHEMA, CMP_SCHEMA } from './method.js';
export { METHOD, SCHEMA, CMP_SCHEMA };

// The method itself (codes, weights, bands, decisions, states) comes from
// core/tc_core/method.json through the generated assets/method.js, shared with the Python core.
export const CODES = Object.fromEntries(METHOD.codes.map((c) => [c.code, [c.name, c.test]]));
if (UR) for (const c in CODES) CODES[c] = [t(`code.${c}`), t(`code.${c}.t`)];

export const SEVERITIES = METHOD.severities.map((x) => x.name);
// Penalised severities. Neutral (MQM's zero-weight level) records a deliberate transposition
// or a compensated loss: it is shown and counted separately, and never enters the score.
export const SCORED = METHOD.severities.filter((x) => x.weight > 0).map((x) => x.name);
export const FINDING_SEVERITIES = SCORED;
// Human review of the AI suggestion for a segment.
export const REVIEW = [...METHOD.reviewStates];

export const DECISIONS = METHOD.decisions.map((d) => [d.key, d.meaning]);
// The first item is the value stored in reports; only the meaning is shown translated here.
// Use label('decision', d) from i18n.js to show a decision's name.
if (UR) for (const d of DECISIONS) d[1] = t(`decision.${d[0]}.m`);

export const ACK = UR ? t('ack.draft') : METHOD.acknowledgements['Pre-publication'];
export const ACK_PUBLISHED = UR ? t('ack.published') : METHOD.acknowledgements.Published;

// Two kinds of assessment: a draft before publication (editorial decision for a publisher)
// and a translation already in print (grade for readers).
export const STAGES = [...METHOD.stages];
export const TEXT_TYPES = [...METHOD.textTypes];
export const isPublished = (r) => r.stage === 'Published';

// MQM severity weights, as in MQM 2.0 scoring.
export const WEIGHTS = Object.fromEntries(METHOD.severities.map((x) => [x.name, x.weight]));

// Grades for published translations, by weighted penalty points per 100 source words.
export const GRADES = METHOD.grades.map((g) => [g.letter, g.name, g.maxPp100 ?? Infinity, g.meaning]);
if (UR) for (const g of GRADES) { g[1] = t(`grade.${g[0]}`); g[3] = t(`grade.${g[0]}.m`); }
export const bandFor = (pp100) => GRADES.find((g) => pp100 <= g[2]) || GRADES[GRADES.length - 1];
// The quality score is 100 minus penalty points per 100 words, so each band has a score range too.
export const scoreRange = (letter) => {
  const i = GRADES.findIndex((g) => g[0] === letter); if (i < 0) return '';
  const hi = i ? 100 - GRADES[i - 1][2] : 100, lo = GRADES[i][2] === Infinity ? null : 100 - GRADES[i][2];
  return lo === null ? t('grade.below', { max: hi }) : i ? `${lo}–${hi}` : t('grade.andAbove', { min: lo });
};

// Targets for reading a score: acceptable is band B (95+), ideal is band A (98+).
export const TARGETS = { ...METHOD.targets };
export function scoreGuide(t) {
  const lvl = (letter) => { const g = GRADES.find((x) => x[0] === letter);
    return { letter, name: g[1], score: 100 - g[2], maxPenalty: Math.floor((g[2] * t.words) / 100) }; };
  const acc = lvl(TARGETS.acceptable), ideal = lvl(TARGETS.ideal);
  const status = t.score >= ideal.score ? 'ideal' : t.score >= acc.score ? 'acceptable' : 'below';
  return { acc, ideal, status, toAcc: Math.max(0, t.penalty - acc.maxPenalty), toIdeal: Math.max(0, t.penalty - ideal.maxPenalty) };
}

// Default editorial decision for each score band. The assessor may move a draft one step off it, with the reason in the basis.
export const DECISION_ANCHOR = Object.fromEntries(METHOD.decisions.map((d) => [d.band, [d.key]]));
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
// Mixed-script text. In English-dominant text each Urdu run is isolated as right-to-left; in
// Urdu-dominant text (the Urdu twins) each Latin run is isolated as left-to-right instead, so that a
// dir="auto" container takes its direction from the Urdu (elements with their own dir are skipped).
const ARABIC = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/g;
const LATIN = /[A-Za-z\u00C0-\u024F]/g;
const LATIN_RUN = /[A-Za-z\u00C0-\u024F][^<&\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]*/g;
// Dominant script by words; on the Urdu page a tie counts as Urdu (a short Urdu item with an English gloss).
export const urduDominant = (text) => {
  const ws = String(text).split(/\s+/);
  const ur = ws.filter((w) => /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(w)).length;
  const la = ws.filter((w) => /[A-Za-z\u00C0-\u024F]/.test(w)).length;
  return ur > la || (UR && ur > 0 && ur === la);
};
export function urduWrap(html) {
  const plain = String(html).replace(/<[^>]+>/g, '');
  if (urduDominant(plain)) {
    return html.replace(/(<[^>]+>)|([^<]+)/g, (m, tag, text) =>
      tag ? tag : text.split(/(&[#\w]+;)/).map((part, i) => (i % 2 ? part : part.replace(LATIN_RUN, (r) => {
        let t = r.replace(/[\s,]+$/, '');
        // Leave an unbalanced closing bracket outside the isolate, with its opening partner.
        while (/[)\]]$/.test(t) && (t.match(/[(\[]/g) || []).length < (t.match(/[)\]]/g) || []).length) t = t.slice(0, -1).replace(/[\s,]+$/, '');
        return `<span dir="ltr">${t}</span>${r.slice(t.length)}`; }))).join(''));
  }
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

// ---------- proximity: a second, independent axis ----------
// How much of the source's form survives, counted within the pair only (no outside norm).
// It describes strategy and never enters the score or the outcome.
export const PROX_KEYS = [...METHOD.proximity.keys];
export const PROX_MIN = METHOD.proximity.min; // a component needs at least this many cases (kept cases, for mimicry) to enter an average
// The mechanical-mimicry corner: mimicry at or above `art` with a quality score below `score`.
// Left unset until enough reports have been marked to place the threshold.
export const MIMIC = METHOD.proximity.mimicThreshold;
// For each component: proximity = kept / all (descriptive), mimicry = forced / kept (the assessor's judgement).
export function proximity(r) {
  const comps = PROX_KEYS.map((k) => {
    const x = r.proximity?.[k] || {}; const total = +x.total || 0; const kept = +x.kept || 0;
    const forced = x.forced == null || x.forced === '' ? null : +x.forced;
    return { key: k, kept, total, forced, note: x.note || '', forcedNote: x.forcedNote || '',
      counted: total >= PROX_MIN, pct: total ? (100 * kept) / total : null,
      artCounted: forced != null && kept >= PROX_MIN, artPct: forced != null && kept ? (100 * forced) / kept : null };
  });
  const avg = (xs) => (xs.length ? xs.reduce((a, v) => a + v, 0) / xs.length : null);
  return { comps, score: avg(comps.filter((x) => x.counted).map((x) => x.pct)), art: avg(comps.filter((x) => x.artCounted).map((x) => x.artPct)) };
}
export const isMimicry = (art, score) => !!MIMIC && art != null && art >= MIMIC.art && score < MIMIC.score;
// Mimicry across, quality score up. points: [{x, y, label?, href?}]
export function gridSVG(points) {
  const W = 560, H = 360, L = 58, Rm = 18, Tp = 14, B = 56, yMin = 40;
  const X = (v) => L + (Math.min(Math.max(v, 0), 100) / 100) * (W - L - Rm);
  const Y = (v) => Tp + (1 - (Math.min(Math.max(v, yMin), 100) - yMin) / (100 - yMin)) * (H - Tp - B);
  const e = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  let s = `<svg class="pgrid-svg" viewBox="0 0 ${W} ${H}" direction="ltr" role="img" aria-label="${e(t('art.axisX'))} / ${e(t('prox.axisY'))}">`;
  if (MIMIC) {
    s += `<rect class="zone" x="${X(MIMIC.art)}" y="${Y(MIMIC.score)}" width="${X(100) - X(MIMIC.art)}" height="${Y(yMin) - Y(MIMIC.score)}"/>`;
    s += `<text class="zone-l" x="${X(100) - 6}" y="${Y(yMin) - 8}" text-anchor="end">${e(t('prox.zone'))}</text>`;
  }
  for (const v of [0, 25, 50, 75, 100]) s += `<line class="gl" x1="${X(v)}" y1="${Y(100)}" x2="${X(v)}" y2="${Y(yMin)}"/><text class="tk" x="${X(v)}" y="${Y(yMin) + 16}" text-anchor="middle">${v}</text>`;
  for (const v of [40, 60, 80, 100]) s += `<text class="tk" x="${L - 8}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`;
  for (const v of [90, 95, 98]) s += `<line class="band" x1="${L}" y1="${Y(v)}" x2="${X(100)}" y2="${Y(v)}"/>`;
  for (const [g, v] of [['A', 99], ['B', 96.5], ['C', 92.5], ['D', 86]]) s += `<text class="band-l g${g}" x="${L + 6}" y="${Y(v) + 4}">${g}</text>`;
  s += `<line class="ax" x1="${L}" y1="${Y(yMin)}" x2="${X(100)}" y2="${Y(yMin)}"/><line class="ax" x1="${L}" y1="${Y(100)}" x2="${L}" y2="${Y(yMin)}"/>`;
  s += `<text class="axe left" x="${L}" y="${H - 10}">← ${e(t('art.left'))}</text><text class="axe right" x="${X(100)}" y="${H - 10}" text-anchor="end">${e(t('art.right'))} →</text>`;
  s += `<text class="axt" x="${(L + X(100)) / 2}" y="${H - 10}" text-anchor="middle">${e(t('art.axisX'))}</text>`;
  s += `<text class="axt" transform="translate(16 ${(Y(100) + Y(yMin)) / 2}) rotate(-90)" text-anchor="middle">${e(t('prox.axisY'))}</text>`;
  // Labels: one line per part (author, translator), centred on the dot,
  // above it if free, else below, else to a side; never overlapping.
  const boxes = points.map((p) => [X(p.x) - 9, Y(p.y) - 9, X(p.x) + 9, Y(p.y) + 9]);
  const LH = 13;
  // Hover card: name (if any), then proximity and quality score with its band.
  const tips = [];
  const tip = (p, lines) => {
    const g = bandFor(100 - p.y);
    const rows = [[t('art.axisX'), String(Math.round(p.x))], [t('prox.axisY'), `${p.y.toFixed(1)} · ${g[0]}`]];
    const head = lines.join(' · ');
    const w = Math.max(head.length * 7, ...rows.map(([k, v]) => (k.length + v.length) * 6.6 + 18)) + 20;
    const h = 14 + (head ? 18 : 0) + rows.length * 17;
    const px = X(p.x), py = Y(p.y);
    const x0 = px + 14 + w > W - 2 ? px - 14 - w : px + 14;
    const y0 = Math.min(Math.max(py - h / 2, 2), H - h - 2);
    let o = `<g class="tip" data-for="${tips.length}" transform="translate(${x0} ${y0})"><rect width="${w}" height="${h}" rx="6"/>`;
    let y = 19;
    if (head) { o += `<text class="tip-h" x="10" y="${y}">${e(head)}</text>`; y += 18; }
    for (const [k, v] of rows) { o += `<text class="tip-k" x="10" y="${y}">${e(k)}</text><text class="tip-v g${g[0]}" x="${w - 10}" y="${y}" text-anchor="end">${e(v)}</text>`; y += 17; }
    return o + '</g>';
  };
  const place = (px, py, lines) => {
    const w = Math.max(...lines.map((l) => l.length)) * 6.6 + 4, h = lines.length * LH;
    const cands = [[px - w / 2, py - 12 - h, 'middle'], [px - w / 2, py + 12, 'middle'], [px + 12, py - h / 2, 'start'], [px - 12 - w, py - h / 2, 'end']];
    for (const [x0, y0, anchor] of cands) {
      const b = [x0, y0, x0 + w, y0 + h];
      if (b[0] < L + 2 || b[2] > W - 2 || b[1] < 0 || b[3] > Y(yMin) - 2) continue;
      if (!boxes.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1])) {
        boxes.push(b); return { x: anchor === 'middle' ? px : anchor === 'start' ? x0 : x0 + w, y: y0 + LH - 3, anchor };
      }
    }
    return { x: px, y: py - 12 - h + LH - 3, anchor: 'middle' };
  };
  for (const p of points) {
    const m = isMimicry(p.x, p.y) ? ' mim' : '';
    const lines = p.label ? (Array.isArray(p.label) ? p.label : [p.label]) : [];
    let lab = '';
    if (lines.length) {
      const q = place(X(p.x), Y(p.y), lines);
      lab = `<text class="pl${m}" x="${q.x}" y="${q.y}" text-anchor="${q.anchor}">` + lines.map((l, i) => `<tspan x="${q.x}" dy="${i ? LH : 0}">${e(l)}</tspan>`).join('') + '</text>';
    }
    const dot = `<circle class="pt${m}" cx="${X(p.x)}" cy="${Y(p.y)}" r="7"/>`;
    tips.push(tip(p, lines));
    s += `<g class="pg" data-i="${tips.length - 1}">${p.href ? `<a href="${e(p.href)}">${dot}${lab}</a>` : dot + lab}</g>`;
  }
  const css = tips.map((_, i) => `.pgrid-svg:has(.pg[data-i="${i}"]:hover) .tip[data-for="${i}"]`).join(',');
  return s + tips.join('') + (css ? `<style>${css}{opacity:1}</style>` : '') + '</svg>';
}

// Legend shown under every grid (the corner entries only once a threshold is set).
export const gridLegend = () => `<div class="pgrid-legend"><span><i class="dot"></i>${t('prox.legendOut')}</span>${MIMIC ? `<span><i class="dot mim"></i>${t('prox.legendIn')}</span><span><i class="sw"></i>${t('prox.legendZone', { art: MIMIC.art, score: MIMIC.score })}</span>` : ''}</div>`;
// A compact mimicry bar for report cards.
export function proxBar(r, quality) {
  const p = proximity(r).art; if (p == null) return '';
  const m = isMimicry(p, quality);
  return `<div class="rc-prox${m ? ' mim' : ''}"><div class="rc-prox-head"><span>${t('art.axisX')} <b>${Math.round(p)}</b></span>${m ? `<span class="rc-mim">${t('prox.zone')}</span>` : ''}</div>
    <div class="rc-prox-track" dir="ltr">${MIMIC ? `<span class="rc-prox-zone" style="left:${MIMIC.art}%"></span>` : ''}<span class="rc-prox-mark" style="left:${p}%"></span></div>
    <div class="rc-prox-ends" dir="ltr"><span>${t('art.left')}</span><span>${t('art.right')}</span></div></div>`;
}

export const REPO = 'aasem/translation-criticism';
export const BRANCH = 'main';

// ---------- live figures in prose ----------
// Tokens such as {total} or {A1} in any prose field are replaced with figures
// computed from the deviations, so the prose always matches the count table.
export const TOKENS = { ...METHOD.tokens, A1: '…and so on for any single code' };
// Rows grouped by source sentence; labels '3' (one row) or '3.1', '3.2' (several).
export function groups(report) {
  const out = [];
  for (const s of report.segments || []) {
    if (out.length && out[out.length - 1][0].sentence === s.sentence) out[out.length - 1].push(s); else out.push([s]);
  }
  return out;
}
export function labels(report) {
  return groups(report).flatMap((g) => g.map((s, j) => (g.length === 1 ? String(s.sentence) : `${s.sentence}.${j + 1}`)));
}
export function figures(report) {
  const t = tally(report);
  const f = {
    total: t.n, critical: t.total.Critical, major: t.total.Major, minor: t.total.Minor,
    severe: t.total.Critical + t.total.Major, per100: t.per100(t.n), words: t.words,
    segments: groups(report).length, rows: (report.segments || []).length, penalty: t.penalty, pp100: t.pp100.toFixed(1),
    score: t.score.toFixed(1), band: `${t.band[0]} (${t.band[1]})`, A: 0, B: 0, C: 0, neutral: t.neutral,
  };
  // Spread across segments (source sentences): descriptive only, never part of the score or grade.
  const sents = groups(report);
  const pct = (n) => (sents.length ? Math.round((100 * n) / sents.length) : 0);
  const scored = (g) => g.flatMap((x) => x.deviations || []).filter((d) => SCORED.includes(d.severity));
  f.clean = sents.filter((g) => !scored(g).length).length;
  f.severeSegs = sents.filter((g) => scored(g).some((d) => d.severity !== 'Minor')).length;
  const ag = agreement(report); Object.assign(f, ag);
  { const pr = proximity(report); const rnd = (x) => (x == null ? '–' : Math.round(x)); f.proximity = rnd(pr.score); f.mimicry = rnd(pr.art); }
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
// The function test in the Urdu editor: the same list, showing and saving the Urdu lines (fnUr);
// kept/lost marks are shared by both languages. Extra lines become new entries (English filled from
// the Urdu until edited); fewer lines remove entries from the end.
export const fnToTextUr = (a) => (a || []).map((x) => `${x.kept ? '+' : '-'} ${x.fnUr || x.fn}`).join('\n');
export function textToFnUr(text, prev) {
  return textToFn(text).map((x, k) => {
    const old = (prev || [])[k];
    return old ? { ...old, kept: x.kept, fnUr: x.fn } : { fn: x.fn, fnUr: x.fn, kept: x.kept };
  });
}
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

// ---------- canonical form ----------
// The same rules as core/tc_core/normalize.py, driven by the same schema: upgrade an older
// report, fill every missing field from the schema's defaults, keep schema key order.
// Unknown keys are kept at the end so nothing is lost; the validator reports them.
const resolve = (s, root) => { while (s && s.$ref) s = root.$defs[s.$ref.split('/').pop()]; return s; };
const types = (s) => [].concat(s?.type ?? []);
function norm(v, s, root = s) {
  s = resolve(s, root); const ty = types(s);
  if (v === undefined || (v === null && !ty.includes('null'))) {
    if (ty.includes('object')) v = {}; else return structuredClone(s?.default ?? null);
  }
  if (ty.includes('object') && v && typeof v === 'object' && !Array.isArray(v)) {
    const props = s.properties || {}; const out = {};
    for (const k of Object.keys(props)) out[k] = norm(v[k], props[k], root);
    for (const k of Object.keys(v)) if (!(k in props)) out[k] = v[k];
    return out;
  }
  if (ty.includes('array') && Array.isArray(v)) return s.items ? v.map((x) => norm(x, s.items, root)) : v;
  if (ty.includes('integer')) {
    if (typeof v === 'string') { const x = v.trim(); if (x === '' && ty.includes('null')) return null; if (/^\d+$/.test(x)) return +x; }
  }
  return v;
}
export function upgrade(r) {
  r = structuredClone(r);
  if ((r.schema ?? 1) < 2) {
    for (const s of r.segments || []) {
      const m = String(s.submission || '').trim().match(/^\(merged into #(\d+)\)$/);
      if (m) { s.mergedInto = +m[1]; s.submission = ''; }
    }
    delete r._comment; r.schema = 2;
  }
  if (r.schema < 3) { r.segmentation ??= { rule: 'sentence-v2', exceptions: '' }; r.schema = 3; }
  if (r.schema < 4) { for (const s of r.segments || []) s.sentence ??= s.n || 1; r.schema = 4; }
  if (r.schema < 5) r.schema = 5;
  const other = r.stage === 'Published' ? ['decision', 'decisionBasis', 'publisherNote'] : ['grade', 'gradeBasis', 'readerNote'];
  if (r[other[0]] && !other.slice(1).some((k) => String(r[k] || '').trim())) r[other[0]] = '';
  return r;
}
export const normalize = (r) => norm(upgrade(r), SCHEMA);
export const normalizeComparison = (c) => { c = structuredClone(c); if ((c.schema ?? 1) < 2) c.schema = 2; return norm(c, CMP_SCHEMA); };

// ---------- Urdu twins ----------
// Mirrors core/tc_core/localize.py: on the Urdu page a filled '<field>Ur' replaces its English field.
function walkTwin(o, parts, fn) {
  if (!parts.length || o == null) return;
  const [h, ...rest] = parts;
  if (h === '*') { for (const x of Array.isArray(o) ? o : Object.values(o)) walkTwin(x, rest, fn); }
  else if (!rest.length) { if (typeof o === 'object') fn(o, h); }
  else if (typeof o === 'object') walkTwin(o[h], rest, fn);
}
export function localize(doc, kind = 'report') {
  const out = structuredClone(doc);
  if (!UR) return out;
  for (const p of METHOD.urduTwins[kind]) walkTwin(out, p.split('.'), (o, k) => { const v = o[k + 'Ur']; if (typeof v === 'string' && v.trim()) o[k] = v; });
  return out;
}
// Whether a dotted edit path (segments.3.deviations.0.note) is a twinned field.
export function isTwin(path, kind = 'report') {
  const a = path.split('.').map((x) => (/^\d+$/.test(x) ? '*' : x));
  return METHOD.urduTwins[kind].some((p) => { const b = p.split('.'); return b.length === a.length && b.every((x, i) => x === '*' || x === a[i] || (a[i] === '*' && x === '*')); });
}
// In the Urdu interface the editor writes the twin.
export const editPath = (path, kind = 'report') => (UR && isTwin(path, kind) ? path + 'Ur' : path);

// ---------- comparisons ----------
// Mirrors core/tc_core/compare.py (checked by core/tests/test_compare.py). Nothing is re-scored:
// every figure comes from the member reports, each measured only against the source.
export const memberLabel = (entry, r, k) =>
  String(entry?.label || r.submission?.translator || r.submission?.label || `${t('cmp.translationN', { k })}`).trim();
export function analyse(cmp, reports) {
  const members = (cmp.members || []).map((e, i) => {
    const r = reports[i], tl = tally(r), f = figures(r), p = proximity(r);
    return { id: r.id, label: memberLabel(e, r, i + 1), stage: r.stage, outcome: isPublished(r) ? r.grade : r.decision,
      score: tl.score, pp100: tl.pp100, penalty: tl.penalty, band: tl.band[0], total: tl.n, severe: tl.total.Critical + tl.total.Major,
      A: f.A, B: f.B, C: f.C, proximity: p.score, mimicry: p.art, wins: 0 };
  });
  const gs = reports.map(groups);
  const n = Math.min(...gs.map((g) => g.length));
  const segments = [];
  for (let i = 0; i < n; i++) {
    const devs = gs.map((g) => g[i].flatMap((s) => s.deviations || []));
    const pens = devs.map((ds) => ds.reduce((a, d) => a + WEIGHTS[d.severity], 0));
    const low = Math.min(...pens);
    const lowest = pens.map((x, k) => (x === low ? k : -1)).filter((k) => k >= 0);
    const tie = lowest.length === pens.length;
    const sets = devs.map((ds) => new Set(ds.filter((d) => SCORED.includes(d.severity)).map((d) => d.code)));
    const hard = sets.every((x) => x.size);
    const shared = [...sets[0]].filter((c) => sets.every((x) => x.has(c))).sort();
    if (!tie) for (const k of lowest) members[k].wins++;
    segments.push({ n: i + 1, penalties: pens, lowest, tie, hard, shared });
  }
  return { members, segments, hard: segments.filter((s) => s.hard).map((s) => s.n), ties: segments.filter((s) => s.tie).length,
    words: reports.length ? tally(reports[0]).words : 0 };
}
export function cmpFigures(cmp, reports) {
  const a = analyse(cmp, reports);
  const f = { segments: a.segments.length, words: a.words, members: a.members.length, hard: a.hard.length, ties: a.ties };
  a.members.forEach((m, i) => {
    const k = i + 1, g = bandFor(m.pp100);
    Object.assign(f, { [`score.${k}`]: m.score.toFixed(1), [`band.${k}`]: `${g[0]} (${g[1]})`, [`total.${k}`]: m.total,
      [`severe.${k}`]: m.severe, [`penalty.${k}`]: m.penalty, [`pp100.${k}`]: m.pp100.toFixed(1),
      [`A.${k}`]: m.A, [`B.${k}`]: m.B, [`C.${k}`]: m.C, [`wins.${k}`]: m.wins });
  });
  return f;
}
export const fillCmp = (text, f) => String(text ?? '').replace(/\{(\w+(?:\.\d+)?)\}/g, (m, k) => (k in f ? String(f[k]) : m));

// Tag chips: on the Urdu page a tag that names the author shows the Urdu name, a language tag its Urdu name.
export const tagLabel = (tag, enAuthor, author) => (UR && tag === enAuthor && author ? author : UR ? labelLang(tag) : tag);
const labelLang = (x) => { const k = `lang.${x}`; const v = t(k); return v === k ? x : v; };
export const langName = (x) => (UR ? labelLang(x) : x ?? '');
