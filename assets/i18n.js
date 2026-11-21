// Language switch (English / Urdu). The English text lives in the pages themselves;
// in Urdu mode, elements marked data-i18n get the Urdu from strings.js.
import { STRINGS } from './strings.js';

const KEY = 'tc-lang';
export const LANG = (() => {
  const q = new URLSearchParams(location.search).get('lang');
  if (q === 'ur' || q === 'en') { try { localStorage.setItem(KEY, q); } catch {} return q; }
  try { return localStorage.getItem(KEY) === 'ur' ? 'ur' : 'en'; } catch { return 'en'; }
})();
export const UR = LANG === 'ur';

const sub = (s, v) => s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? String(v[k]) : m));

// t('key', {vars}) gives the string in the current language.
export function t(key, vars = {}) {
  const s = STRINGS[key];
  if (!s) return key;
  return sub(UR && s[1] ? s[1] : s[0], vars);
}

// tr('key', vars, englishHtml): Urdu from strings.js, or the page's own English markup.
export const tr = (key, vars, en) => (UR ? t(key, vars) : en);

// label('decision', 'Accept') translates a value stored in a report (decision, stage, stakes, severity).
export const label = (prefix, value) => (UR && STRINGS[`${prefix}.${value}`] ? t(`${prefix}.${value}`) : value ?? '');

// Rebuild an element's text from a translated string, keeping the child elements
// marked data-slot="name" where the string has {name}.
function fillEl(el, str) {
  const slots = {};
  el.querySelectorAll('[data-slot]').forEach((c) => (slots[c.dataset.slot] = c));
  const frag = document.createDocumentFragment();
  for (const part of str.split(/(\{\w+\})/)) {
    const m = part.match(/^\{(\w+)\}$/);
    if (m && slots[m[1]]) frag.append(slots[m[1]]);
    else if (part) frag.append(document.createTextNode(part));
  }
  el.replaceChildren(frag);
}

export function applyStatic(root = document) {
  if (!UR) return;
  root.querySelectorAll('.ur-only').forEach((el) => (el.hidden = false));
  root.querySelectorAll('[data-i18n]').forEach((el) => fillEl(el, t(el.dataset.i18n)));
  root.querySelectorAll('[data-i18n-ph]').forEach((el) => (el.placeholder = t(el.dataset.i18nPh)));
  root.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); el.setAttribute('aria-label', el.title); });
  root.querySelectorAll('[data-i18n-label]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nLabel)));
}

function wireSwitch() {
  document.querySelectorAll('.lang-switch').forEach((a) => {
    a.textContent = t('nav.lang');
    a.lang = UR ? 'en' : 'ur';
    a.addEventListener('click', (e) => {
      e.preventDefault();
      try { localStorage.setItem(KEY, UR ? 'en' : 'ur'); } catch {}
      const u = new URL(location.href); u.searchParams.delete('lang'); location.href = u.href;
    });
  });
}

document.documentElement.lang = LANG;
document.documentElement.dir = UR ? 'rtl' : 'ltr';
document.documentElement.classList.toggle('lang-ur', UR);
applyStatic();
wireSwitch();
