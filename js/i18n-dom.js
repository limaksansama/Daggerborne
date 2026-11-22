/* UI localisation layer for English mode.
   Some legacy views still render French strings directly. Rather than
   duplicating every template, this module translates the rendered DOM (text
   nodes + user-facing attributes) using the phrase dictionary in en-ui.js.
   It is a no-op in French mode and never touches form fields or user content.

   Translations are reversible: the original French value of every node we
   touch is remembered so switching back to French restores static UI (the
   floating dice launcher, for example) instead of leaving it in English. */
import { getLang } from './i18n.js';
import { EN_UI, EN_UI_EXACT, EN_PATTERNS } from './en-ui.js';

const PAIRS = Object.entries(EN_UI).sort((a, b) => b[0].length - a[0].length);
/* .jrn-text / .jrn-date : contenu saisi par l'utilisateur, jamais traduit */
const SKIP_TEXT = 'textarea, input, script, style, code, pre, .jrn-text, .jrn-date, [data-no-i18n]';
const ATTRS = ['title', 'placeholder', 'aria-label', 'alt'];
let started = false;
let applying = false;
const TEXT_ORIGINALS = new WeakMap();   /* text node -> { orig, trans } */
const ATTR_ORIGINALS = new WeakMap();   /* element -> Map(attr -> { orig, trans }) */

export function trUi(value) {
  if (!value || getLang() !== 'en') return value;
  let out = String(value);
  const trimmed = out.trim();
  if (Object.prototype.hasOwnProperty.call(EN_UI_EXACT, trimmed)) {
    return out.replace(trimmed, EN_UI_EXACT[trimmed]);
  }
  for (const [fr, en] of PAIRS) {
    if (out.includes(fr)) out = out.split(fr).join(en);
  }
  for (const [re, rep] of EN_PATTERNS) out = out.replace(re, rep);
  return out;
}

function translateTextNode(node) {
  const parent = node.parentElement;
  if (!parent || parent.closest(SKIP_TEXT)) return;

  if (getLang() === 'en') {
    const current = node.nodeValue;
    let rec = TEXT_ORIGINALS.get(node);
    /* A value the app changed since our last pass becomes the new source. */
    if (!rec || (current !== rec.orig && current !== rec.trans)) {
      rec = { orig: current, trans: trUi(current) };
      TEXT_ORIGINALS.set(node, rec);
    }
    if (current !== rec.trans) {
      applying = true;
      node.nodeValue = rec.trans;
      applying = false;
    }
  } else {
    const rec = TEXT_ORIGINALS.get(node);
    if (rec && node.nodeValue === rec.trans && rec.orig !== rec.trans) {
      applying = true;
      node.nodeValue = rec.orig;
      applying = false;
    }
  }
}

function translateAttributes(el) {
  if (!el.hasAttribute) return;
  for (const attr of ATTRS) {
    if (!el.hasAttribute(attr)) continue;
    const current = el.getAttribute(attr);

    if (getLang() === 'en') {
      let map = ATTR_ORIGINALS.get(el);
      if (!map) { map = new Map(); ATTR_ORIGINALS.set(el, map); }
      let rec = map.get(attr);
      if (!rec || (current !== rec.orig && current !== rec.trans)) {
        rec = { orig: current, trans: trUi(current) };
        map.set(attr, rec);
      }
      if (current !== rec.trans) {
        applying = true;
        el.setAttribute(attr, rec.trans);
        applying = false;
      }
    } else {
      const rec = ATTR_ORIGINALS.get(el)?.get(attr);
      if (rec && current === rec.trans && rec.orig !== rec.trans) {
        applying = true;
        el.setAttribute(attr, rec.orig);
        applying = false;
      }
    }
  }
}

export function translateDom(root) {
  if (!root) return;
  if (root.nodeType === 3) {
    translateTextNode(root);
    return;
  }
  if (root.nodeType !== 1 && root.nodeType !== 9) return;
  if (root.nodeType === 1) translateAttributes(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node.nodeType === 3) translateTextNode(node);
    else translateAttributes(node);
    node = walker.nextNode();
  }
}

const CHROME = {
  fr: {
    title: 'Daggerborne · Compagnon JDR',
    description: 'Daggerborne — Fiche de personnage numérique interactive compatible avec Daggerheart™ : création guidée, dés de Dualité, compendium français.',
  },
  en: {
    title: 'Daggerborne · TTRPG Companion',
    description: 'Daggerborne — Interactive digital character sheet compatible with Daggerheart™: guided creation, Duality Dice, compendium.',
  },
};

function translateDocumentChrome() {
  const lang = getLang() === 'en' ? 'en' : 'fr';
  document.title = CHROME[lang].title;
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute('content', CHROME[lang].description);
  document.documentElement.lang = lang;
}

export function initUiTranslation() {
  translateDocumentChrome();
  /* In FR this restores values translated earlier; new nodes are untouched. */
  translateDom(document.body);
  if (started) return;
  started = true;
  const observer = new MutationObserver((mutations) => {
    if (applying || getLang() !== 'en') return;
    for (const m of mutations) {
      if (m.type === 'characterData') translateTextNode(m.target);
      else if (m.type === 'attributes' && m.target.nodeType === 1) translateAttributes(m.target);
      else if (m.type === 'childList') {
        for (const n of m.addedNodes) {
          if (n.nodeType === 1 || n.nodeType === 3) translateDom(n);
        }
      }
    }
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ATTRS,
  });
}
