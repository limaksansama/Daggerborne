import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* ==================== Lightweight DOM & Browser Mock for Integration Tests ==================== */
function camel(s) {
  return s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

const VOID_TAGS = new Set(['img', 'input', 'br', 'hr', 'meta', 'link']);

function parseAttrs(raw) {
  const attrs = {};
  const re = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m;
  while ((m = re.exec(raw))) {
    const k = m[1];
    const v = m[2] ?? m[3] ?? m[4] ?? '';
    attrs[k] = v;
  }
  return attrs;
}

class MockElement {
  constructor(tag = 'div', attrs = {}) {
    this.tagName = tag.toUpperCase();
    this.attributes = { ...attrs };
    this.children = [];
    this.parentNode = null;
    this.listeners = {};
    this._innerHTML = '';
    this._textContent = '';
    this.style = {};
    this.value = attrs.value ?? '';
    this.checked = 'checked' in attrs;
    this.disabled = 'disabled' in attrs;
    this.open = 'open' in attrs;
    this.dataset = new Proxy({}, {
      get: (_, k) => {
        const attrKey = 'data-' + String(k).replace(/[A-Z]/g, c => '-' + c.toLowerCase());
        return this.attributes[attrKey];
      },
      set: (_, k, v) => {
        const attrKey = 'data-' + String(k).replace(/[A-Z]/g, c => '-' + c.toLowerCase());
        this.attributes[attrKey] = String(v);
        return true;
      },
    });
    this.classList = {
      _set: () => new Set((this.attributes.class || '').split(/\s+/).filter(Boolean)),
      _save: (set) => { this.attributes.class = [...set].join(' '); },
      add: (...cls) => { const s = this.classList._set(); cls.forEach(c => s.add(c)); this.classList._save(s); },
      remove: (...cls) => { const s = this.classList._set(); cls.forEach(c => s.delete(c)); this.classList._save(s); },
      contains: (c) => this.classList._set().has(c),
      toggle: (c, force) => {
        const s = this.classList._set();
        const add = force !== undefined ? !!force : !s.has(c);
        if (add) s.add(c); else s.delete(c);
        this.classList._save(s);
        return add;
      },
    };
  }

  get id() { return this.attributes.id || ''; }
  set id(v) { this.attributes.id = String(v); }
  get className() { return this.attributes.class || ''; }
  set className(v) { this.attributes.class = String(v); }
  get isConnected() {
    let cur = this;
    while (cur) {
      if (cur === globalThis.document?.body) return true;
      cur = cur.parentNode;
    }
    return false;
  }
  contains(node) {
    if (!node) return false;
    let cur = node;
    while (cur) {
      if (cur === this) return true;
      cur = cur.parentNode;
    }
    return false;
  }

  get innerHTML() {
    if (!this.children.length) return this._innerHTML;
    const ser = (node) => {
      const attrs = Object.entries(node.attributes).map(([k, v]) => ` ${k}="${v}"`).join('');
      const tag = node.tagName.toLowerCase();
      if (VOID_TAGS.has(tag)) return `<${tag}${attrs}>`;
      const inner = node.children.length ? node.children.map(ser).join('') : node._textContent || node._innerHTML;
      return `<${tag}${attrs}>${node._textContent && node.children.length ? node._textContent + ' ' : ''}${inner}</${tag}>`;
    };
    return this.children.map(ser).join('');
  }
  set innerHTML(html) {
    this._innerHTML = String(html ?? '');
    this._textContent = '';
    this.children = [];
    parseHtmlInto(this._innerHTML, this);
    /* Special-case template content */
    if (this.tagName === 'TEMPLATE') {
      this.content = { firstElementChild: this.children[0] || null };
    }
  }

  get textContent() {
    if (this._textContent) return this._textContent;
    const raw = this._innerHTML.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return raw;
  }
  set textContent(t) {
    this._textContent = String(t ?? '');
    this._innerHTML = this._textContent;
    this.children = [];
  }

  appendChild(child) {
    if (!child) return child;
    child.parentNode = this;
    this.children.push(child);
    return child;
  }
  insertAdjacentHTML(pos, html) {
    if (pos === 'beforeend') parseHtmlInto(String(html ?? ''), this);
    else if (pos === 'afterbegin') {
      const tmp = new MockElement('div');
      parseHtmlInto(String(html ?? ''), tmp);
      for (const ch of tmp.children) ch.parentNode = this;
      this.children = [...tmp.children, ...this.children];
    }
  }
  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter(c => c !== this);
    this.parentNode = null;
  }
  getAttribute(k) { return k in this.attributes ? this.attributes[k] : null; }
  setAttribute(k, v) { this.attributes[k] = String(v); }
  focus() { document.activeElement = this; }

  addEventListener(type, fn) {
    this.listeners[type] = this.listeners[type] || [];
    this.listeners[type].push(fn);
  }
  dispatchEvent(ev) {
    const target = ev.target || this;
    let cur = this;
    while (cur) {
      const event = {
        type: ev.type,
        target,
        currentTarget: cur,
        key: ev.key,
        _stopped: false,
        stopPropagation() { this._stopped = true; },
        preventDefault() {},
        ...ev,
        target,
      };
      const fns = cur.listeners[event.type] || [];
      for (const fn of fns) fn.call(cur, event);
      if (event._stopped) break;
      cur = cur.parentNode;
    }
  }
  click() {
    this.dispatchEvent({ type: 'click', target: this });
  }
  closest(sel) {
    let cur = this;
    while (cur) {
      if (matchesSimple(cur, sel)) return cur;
      cur = cur.parentNode;
    }
    return null;
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  querySelectorAll(sel) {
    const out = [];
    const groups = sel.split(',').map(s => s.trim()).filter(Boolean);
    const visit = (node) => {
      for (const ch of node.children) {
        if (groups.some(g => matchesSelector(ch, g))) out.push(ch);
        visit(ch);
      }
    };
    visit(this);
    return out;
  }
}

function matchesSimple(el, sel) {
  if (!el || !sel) return false;
  let rest = sel.trim();
  const tagM = rest.match(/^[a-zA-Z0-9_-]+/);
  if (tagM) {
    if (el.tagName !== tagM[0].toUpperCase()) return false;
    rest = rest.slice(tagM[0].length);
  }
  while (rest.length) {
    if (rest[0] === '#') {
      const m = rest.slice(1).match(/^[^\s.#\[:]+/);
      if (!m || el.id !== m[0]) return false;
      rest = rest.slice(1 + m[0].length);
    } else if (rest[0] === '.') {
      const m = rest.slice(1).match(/^[^\s.#\[:]+/);
      if (!m || !el.classList.contains(m[0])) return false;
      rest = rest.slice(1 + m[0].length);
    } else if (rest[0] === '[') {
      const end = rest.indexOf(']');
      if (end < 0) return false;
      const expr = rest.slice(1, end);
      const eq = expr.indexOf('=');
      if (eq < 0) {
        if (!(expr in el.attributes)) return false;
      } else {
        const k = expr.slice(0, eq).trim();
        const v = expr.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
        if (el.attributes[k] !== v) return false;
      }
      rest = rest.slice(end + 1);
    } else {
      return false;
    }
  }
  return true;
}

function matchesSelector(el, sel) {
  const parts = sel.split(/\s+/).filter(Boolean);
  if (!parts.length) return false;
  if (!matchesSimple(el, parts[parts.length - 1])) return false;
  let cur = el.parentNode;
  for (let i = parts.length - 2; i >= 0; i--) {
    while (cur && !matchesSimple(cur, parts[i])) cur = cur.parentNode;
    if (!cur) return false;
    cur = cur.parentNode;
  }
  return true;
}

function parseHtmlInto(html, root) {
  const stack = [root];
  const tagRe = /<!--[\s\S]*?-->|<\/([a-zA-Z0-9-]+)\s*>|<([a-zA-Z0-9-]+)([^>]*?)(\/?)>/g;
  let lastIdx = 0;
  let m;
  while ((m = tagRe.exec(html))) {
    if (m.index > lastIdx && stack.length) {
      const txt = html.slice(lastIdx, m.index).trim();
      if (txt) stack[stack.length - 1]._textContent = (stack[stack.length - 1]._textContent ? stack[stack.length - 1]._textContent + ' ' : '') + txt;
    }
    lastIdx = tagRe.lastIndex;
    if (m[0].startsWith('<!--')) continue;
    if (m[1]) {
      const closing = m[1].toUpperCase();
      for (let i = stack.length - 1; i >= 1; i--) {
        if (stack[i].tagName === closing) { stack.length = i; break; }
      }
    } else if (m[2]) {
      const tag = m[2].toLowerCase();
      const attrs = parseAttrs(m[3] || '');
      const el = new MockElement(tag, attrs);
      stack[stack.length - 1].appendChild(el);
      if (!m[4] && !VOID_TAGS.has(tag)) stack.push(el);
    }
  }
}

const lsStore = new Map();
globalThis.localStorage = {
  getItem: (k) => (lsStore.has(k) ? lsStore.get(k) : null),
  setItem: (k, v) => lsStore.set(k, String(v)),
  removeItem: (k) => lsStore.delete(k),
  clear: () => lsStore.clear(),
};
globalThis.document = {
  body: new MockElement('body'),
  activeElement: null,
  baseURI: 'http://localhost:3000/',
  createElement: (tag) => new MockElement(tag),
  addEventListener: () => {},
  removeEventListener: () => {},
  querySelector: (s) => globalThis.document.body.querySelector(s),
  querySelectorAll: (s) => globalThis.document.body.querySelectorAll(s),
};
globalThis.window = {
  innerWidth: 1200,
  scrollY: 0,
  scrollTo: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => {},
  confirm: () => true,
  URL,
};
globalThis.history = {
  pushState: () => {},
  back: () => {},
};
globalThis.confirm = () => true;
globalThis.location = { hash: '#home', protocol: 'http:' };
if (!globalThis.navigator) globalThis.navigator = { userAgent: 'NodeTest' };
globalThis.URL = { createObjectURL: () => 'blob:mock', revokeObjectURL: () => {} };
globalThis.Blob = class { constructor(parts) { this.size = parts.join('').length; } };
globalThis.Event = class { constructor(type) { this.type = type; } };
globalThis.fetch = async (url) => {
  const rel = String(url).split('?')[0].replace(/^\//, '');
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) return { ok: false, status: 404, async json() { return {}; } };
  const text = fs.readFileSync(full, 'utf8');
  return { ok: true, status: 200, async json() { return JSON.parse(text); } };
};

/* Dynamic imports AFTER globals are configured */
const core = await import('../js/core.js');
const i18n = await import('../js/i18n.js');
const dice3d = await import('../js/dice3d.js');
const { openLevelUp } = await import('../js/views/levelup.js');
const views = {
  home: await import('../js/views/home.js'),
  chars: await import('../js/views/chars.js'),
  create: await import('../js/views/create.js'),
  sheet: await import('../js/views/sheet.js'),
  dice: await import('../js/views/dice.js'),
  compendium: await import('../js/views/compendium.js'),
  gm: await import('../js/views/gm.js'),
  settings: await import('../js/views/settings.js'),
};
const { initFab } = await import('../js/fab.js');

/* Wait helper for dice3d / async callbacks */
function resetTestState() {
  globalThis.document.body.children = [];
  core.setState(s => {
    s.characters = [];
    s.rolls = [];
    s.fear = 0;
    s.countdowns = [];
    s.encounter = { pcCount: 4, adj: {}, active: [], environmentId: null };
    s.settings = { diceAnim: false, massiveDamageRule: false };
  });
}

/* ==================== Core & Backup Tests ==================== */
test('core: importCharacterFromText validates schema and handles empty names cleanly', () => {
  resetTestState();
  const imported = core.importCharacterFromText(JSON.stringify({
    name: '   ',
    traits: { agility: 1, strength: 0, finesse: 2, instinct: 0, presence: 1, knowledge: -1 },
  }));
  assert.equal(imported.name, 'Sans nom');
  assert.equal(imported.hp.max, 6);
  assert.equal(imported.experiences.length, 5);
  assert.equal(core.getState().characters.length, 1);

  assert.throws(() => core.importCharacterFromText(JSON.stringify({ traits: {} })), /Format/);
  assert.throws(() => core.importCharacterFromText('{bad json'), SyntaxError);
});

test('core: importFullBackupFromText supports merge and replace modes', () => {
  resetTestState();
  const existing = core.newCharacter({ id: 'c-1', name: 'Kaliros', level: 2 });
  core.saveChar(existing);

  const backup = core.cloudSync.exportPayload();
  backup.data.characters[0].name = 'Kaliros Évolué';
  backup.data.characters.push({ id: 'c-2', name: 'Vaelen', traits: { agility: 2 } });

  const mergeRes = core.importFullBackupFromText(JSON.stringify(backup), 'merge');
  assert.equal(mergeRes.updated, 1);
  assert.equal(mergeRes.added, 1);
  assert.equal(mergeRes.total, 2);
  assert.equal(core.getChar('c-1').name, 'Kaliros Évolué');
  assert.equal(core.getChar('c-2').hp.max, 6);

  const replacePayload = {
    schema: 'daggerborne-backup-v1',
    data: { characters: [{ id: 'c-only', name: 'Solo', traits: { strength: 2 } }], fear: 7 },
  };
  const replaceRes = core.importFullBackupFromText(JSON.stringify(replacePayload), 'replace');
  assert.equal(replaceRes.total, 1);
  assert.equal(core.getState().fear, 7);
  assert.equal(core.getChar('c-only').name, 'Solo');
});

test('core: addToHand enforces strict 5-card limit before sending extras to vault', () => {
  const c = core.newCharacter({ name: 'Mage' });
  for (let i = 1; i <= 5; i++) {
    assert.equal(core.addToHand(c, `card-${i}`), true);
  }
  assert.equal(core.addToHand(c, 'card-6'), false);
  assert.equal(c.domainCards.filter(x => x.inHand).length, 5);
  assert.equal(c.domainCards.filter(x => !x.inHand).length, 1);
});

/* ==================== Dice Engine & Non-WebGL Fallback Tests ==================== */
test('dice3d: rollDuality & rollDice work reliably with diceAnim disabled and apply game effects', async () => {
  resetTestState();
  const c = core.newCharacter({
    id: 'dice-pc',
    name: 'Lyra',
    traits: { agility: 2, strength: 1, finesse: 0, instinct: 1, presence: 0, knowledge: -1 },
    scars: 2, /* hope cap becomes 4 */
    hope: { max: 6, current: 3 },
    stress: { max: 6, current: 2, active: 6, unlocked: 0 },
    proficiency: 2,
    weapons: [{ uid: 'w-1', name: 'Lame', trait: 'agility', dice: 'd8', dmgBonus: 2 }],
  });
  core.saveChar(c);

  const r = await dice3d.rollDuality({ mod: 2, label: 'Agilité', charId: 'dice-pc', advantage: true });
  assert.ok(r);
  assert.ok(r.hope >= 1 && r.hope <= 12);
  assert.ok(r.fear >= 1 && r.fear <= 12);
  assert.ok(r.adv >= 1 && r.adv <= 6);
  assert.equal(r.total, r.hope + r.fear + 2 + r.adv);
  assert.ok(c.hope.current <= 4, 'Hope gain must respect scarred cap (4)');
  assert.equal(core.getState().rolls.length, 1);

  const multi = await dice3d.rollDice('1d8 + 2d6 + 3', { label: 'Dégâts mixtes' });
  assert.ok(multi);
  assert.equal(multi.rolls.length, 3);
  assert.equal(multi.mod, 3);
  assert.equal(multi.total, multi.rolls[0] + multi.rolls[1] + multi.rolls[2] + 3);

  const atk = await dice3d.rollAttack('dice-pc', 'w-1');
  assert.ok(atk && atk.total >= 2);
  const dmg = await dice3d.rollDamage('dice-pc', 'w-1');
  assert.ok(dmg && dmg.rolls.length === 2 && dmg.mod === 2);

  const critDmg = await dice3d.rollDamage('dice-pc', 'w-1', { crit: true });
  assert.ok(critDmg);
  assert.equal(critDmg.critMax, 16);
  assert.equal(critDmg.mod, 18);
  assert.equal(critDmg.total, critDmg.rolls[0] + critDmg.rolls[1] + 16 + 2);
});

test('dice3d: critical success (double 2d12) grants +1 Hope, -1 Stress, keeps Spotlight, and chains to critical damage', async () => {
  resetTestState();
  const c = core.newCharacter({
    id: 'crit-pc',
    name: 'Vaelen',
    traits: { agility: 2, strength: 0, finesse: 0, instinct: 0, presence: 0, knowledge: 0 },
    hope: { max: 6, current: 2 },
    stress: { max: 6, current: 2, active: 6, unlocked: 0 },
    proficiency: 2,
    weapons: [{ uid: 'w-1', name: 'Arc long', trait: 'agility', dice: 'd8', dmgBonus: 1 }],
  });
  core.saveChar(c);

  const origRandom = Math.random;
  Math.random = () => 0.4; /* floor(0.4 * 12) + 1 = 5 on both Hope and Fear */
  try {
    const atk = await dice3d.rollAttack('crit-pc', 'w-1');
    assert.ok(atk);
    assert.equal(atk.hope, 5);
    assert.equal(atk.fear, 5);
    assert.equal(atk.result, 'crit');
    assert.equal(c.hope.current, 3, 'Critical success must grant +1 Hope');
    assert.equal(c.stress.current, 1, 'Critical success must clear 1 Stress');
    assert.equal(core.getState().fear, 0, 'Critical success keeps Spotlight (no Fear gained)');

    const dmgBtn = globalThis.document.body.querySelector('.d3d-banner [data-b="dmg"]');
    assert.ok(dmgBtn, 'Chained critical damage button must appear in banner');
    assert.ok(dmgBtn.textContent.includes('critiques'), 'Button must indicate critical damage');
    dmgBtn.click();
    await new Promise(r => setTimeout(r, 20));

    const lastRoll = core.getState().rolls[0];
    assert.equal(lastRoll.notation, '2d8+16+1');
    assert.equal(lastRoll.total, 4 + 4 + 16 + 1);
    const detailTxt = globalThis.document.body.querySelector('.d3d-banner .d3d-detail')?.textContent || '';
    assert.ok(detailTxt.includes('Max 16 (2d8) + [4 + 4] + 1 = 25'), `Unexpected crit detail text: ${detailTxt}`);
  } finally {
    Math.random = origRandom;
  }
});

test('dice3d: automatically falls back to RNG when diceAnim is true but WebGL fails in headless/restricted environment', async () => {
  resetTestState();
  core.setState(s => { s.settings.diceAnim = true; });
  const r = await dice3d.rollDuality({ mod: 1, label: 'Fallback 3D' });
  assert.ok(r, 'Expected RNG fallback result instead of null when 3D canvas init fails');
  assert.ok(r.hope >= 1 && r.hope <= 12);
  const plain = await dice3d.rollDice('2d6', { label: 'Fallback multi' });
  assert.ok(plain && plain.rolls.length === 2);
});

/* ==================== Views Rendering & Fixed Anomalies Tests ==================== */
test('all views render cleanly with real SRD data and expose no formatting artifacts', async () => {
  resetTestState();
  const classes = await core.data('classes');
  const subclasses = await core.data('subclasses');
  const beastforms = await core.data('beastforms');
  const druidClass = classes.find(cl => cl.fr === 'Druide') || classes[0];
  const beastSub = subclasses.find(s => s.en === 'Beastbound') || subclasses[0];

  const c = core.newCharacter({
    id: 'pc-test',
    name: 'Kaliros',
    classId: druidClass.id,
    className: druidClass.fr,
    subclassId: beastSub.id,
    level: 5,
    scars: 1,
    hope: { max: 6, current: 3 },
    traits: { agility: 2, strength: 1, finesse: 0, instinct: -1, presence: 1, knowledge: 0 },
    experiences: [
      { name: 'Pistage', mod: 2 },
      { name: 'Herboristerie', mod: 2 },
      { name: 'Chasse', mod: 2 },
      { name: 'Ruse', mod: 2 },
      { name: 'Survie', mod: 2 },
      { name: 'Sixième Sens', mod: 2 },
    ],
    beastform: { id: 'mythic-beast', fr: 'Bête mythique', baseId: 'agile-scout' },
    weapons: [{
      uid: 'w1', name: 'Épée longue', trait: 'strength', range: 'Mêlée',
      dice: 'd8', dmgBonus: 2, dmgType: 'phy', hands: 'one', state: 'active', primary: true, secondary: false,
    }],
    domainCards: [{ cardId: (await core.data('domainCards'))[0].id, inHand: true }],
  });
  core.saveChar(c);

  const main = new MockElement('main');
  globalThis.document.body.appendChild(main);
  for (const name of ['home', 'chars', 'create', 'dice', 'compendium', 'gm', 'settings']) {
    main.className = '';
    main.innerHTML = '';
    await views[name].render(main, null);
    assert.ok(main.innerHTML.length > 100, `Expected view "${name}" to render non-empty HTML`);
  }

  /* Sheet view + variable Beastform + negative Instinct companion + 6th experience */
  main.innerHTML = '';
  await views.sheet.render(main, 'pc-test');
  assert.ok(!main.innerHTML.includes('undefined'), 'sheet.js rendered "undefined"');
  assert.ok(!main.innerHTML.includes('+-1'), 'sheet.js rendered "+-1" for negative instinct');
  assert.ok(!main.innerHTML.includes('1variable'), 'sheet.js rendered unresolved "variable" dice');
  assert.ok(main.innerHTML.includes('Sixième Sens'), 'Expected 6th experience to render on sheet');
  assert.ok(main.innerHTML.includes('d6'), 'Expected mythic-beast evolved agile-scout d4->d6 step');

  const critBtn = main.querySelector('#dha-crit');
  assert.ok(critBtn, 'Actions & Attaques should render #dha-crit toggle');
  critBtn.click();
  await new Promise(r => setTimeout(r, 20));
  assert.ok(main.querySelector('#dha-crit')?.classList.contains('on'), 'Toggling #dha-crit activates critical damage mode');
  assert.ok(main.innerHTML.includes('16+2d8+2') || main.innerHTML.includes('8+1d8+2'), 'Critical damage formula preview must appear when #dha-crit is active');
  main.querySelector('#dha-crit')?.click();
  await new Promise(r => setTimeout(r, 20));

  /* Compendium adversary sign check + card detail domain label check */
  await views.compendium.render(main, null);
  const advTab = main.querySelector('[data-tab="adversaries"]');
  assert.ok(advTab, 'Compendium adversary tab present');
  advTab.click();
  await new Promise(r => setTimeout(r, 20));
  assert.ok(main.innerHTML.includes('adversaire(s)'), 'Compendium adversary list should render');
  assert.ok(!main.innerHTML.includes('++'), 'Compendium adversary rendered "++"');
  assert.ok(!main.innerHTML.includes('+null'), 'Compendium adversary rendered "+null"');

  /* Compendium transformations: must not shadow the translation function */
  const transTab = main.querySelector('[data-tab="transformations"]');
  assert.ok(transTab, 'Compendium transformations tab present');
  transTab.click();
  await new Promise(r => setTimeout(r, 20));
  assert.ok(main.innerHTML.includes('transformation(s)'), 'Compendium transformations list should render');

  /* GM bestiary sign check & encounter tab */
  await views.gm.render(main, null);
  const gmBestiary = main.querySelector('[data-gmtab="bestiary"]');
  assert.ok(gmBestiary);
  gmBestiary.click();
  await new Promise(r => setTimeout(r, 20));
  assert.ok(main.innerHTML.includes('adversaire(s) — SRD 2.0'), 'GM bestiary should render');
  assert.ok(!main.innerHTML.includes('++'), 'GM bestiary rendered "++"');
  assert.ok(!main.innerHTML.includes('+null'), 'GM bestiary rendered "+null"');

  /* Settings dice3d toggle binding */
  await views.settings.render(main, null);
  const opt3d = main.querySelector('#opt-dice3d');
  assert.ok(opt3d, 'Settings should render #opt-dice3d toggle');
  assert.ok(beastforms.length === 24);
});

test('sheet: remplace la Fondation FR par EN sans doublon lors du changement de langue', async () => {
  resetTestState();
  const classes = await core.data('classes', 'fr');
  const subFr = (await core.data('subclasses', 'fr'))[0];
  const subEn = (await core.data('subclasses', 'en'))[0];
  const cl = classes.find(x => x.id === subFr.classId);
  const c = core.newCharacter({
    id: 'lang-pc',
    name: 'Lang',
    classId: subFr.classId,
    className: cl?.fr || '',
    subclassId: subFr.id,
    subclassText: subFr.fr,
    subcardCount: 1,
    classFeature: `✦ ${subFr.features[0].name} — ${subFr.features[0].desc}`,
  });
  core.saveChar(c);
  const main = new MockElement('main');
  globalThis.document.body.appendChild(main);
  try {
    i18n.setLang('en');
    await views.sheet.render(main, 'lang-pc');
    assert.ok(c.classFeature.includes(subEn.features[0].name), 'Fondation EN attendue');
    assert.ok(!c.classFeature.includes(subFr.features[0].name), 'Fondation FR encore présente');
    assert.equal((c.classFeature.match(/✦/g) || []).length, 1, 'Une seule carte de Fondation attendue');
  } finally {
    i18n.setLang('fr');
    main.remove();
  }
});

/* ==================== Level-Up Wizard Tests ==================== */
test('levelup: enforces 2-point budget, allows multiclass 2-pt option, and updates hp.current on slot gain', async () => {
  resetTestState();
  const classes = await core.data('classes');
  const subclasses = await core.data('subclasses');
  const cl = classes[0];
  const sub = subclasses.find(s => s.classId === cl.id);

  const c = core.newCharacter({
    id: 'lu-pc',
    name: 'Aelar',
    classId: cl.id,
    className: cl.fr,
    subclassId: sub.id,
    level: 4, /* leveling to 5 -> Palier 3 -> proficiency +1 bonus unlocks multiclass */
    hp: { max: 6, current: 6, active: 6, unlocked: 0 },
    stress: { max: 6, current: 0, active: 6, unlocked: 0 },
  });
  core.saveChar(c);

  let doneCalled = false;
  await openLevelUp(c, { onDone: () => { doneCalled = true; } });
  const modal = globalThis.document.body.querySelector('.dh-lvlup');
  assert.ok(modal, 'Level-up modal should mount');

  /* Step 1 (Tier 3 reward: name new Experience) -> Step 2 */
  const expIn = modal.querySelector('#lu-expname');
  assert.ok(expIn, 'Level 4->5 step 1 should ask for new experience');
  expIn.value = 'Pisteur des ombres';
  expIn.dispatchEvent({ type: 'input', target: expIn });
  modal.querySelector('[data-lu-main]').click();
  assert.ok(modal.innerHTML.includes('Points d\'amélioration'), 'Step 2 should render');

  /* Pick hitPointSlots (1 pt) and ensure 2-pt option gets disabled cleanly */
  const hpBtn = modal.querySelector('[data-luopt="hitPointSlots"]');
  const multiBtn = modal.querySelector('[data-luopt="multiclass"]');
  assert.ok(hpBtn && multiBtn);
  assert.equal(multiBtn.disabled, false);

  hpBtn.click();
  assert.equal(modal.querySelector('[data-luopt="multiclass"]').disabled, true, '2-pt option must lock once 1 pt is spent');

  /* Pick stressSlots as 2nd point */
  modal.querySelector('[data-luopt="stressSlots"]').click();
  assert.equal(modal.querySelector('[data-luopt="evasion"]').disabled, true, 'Remaining options must lock at 2 pts');

  /* Step 2 -> Step 3 -> pick a domain card -> Step 4 -> Step 5 -> Apply */
  modal.querySelector('[data-lu-main]').click();
  const cardBtn = modal.querySelector('[data-lupick]');
  assert.ok(cardBtn, 'Step 3 should list eligible domain cards');
  cardBtn.click();
  modal.querySelector('[data-lu-main]').click(); /* step 3 -> 4 */
  modal.querySelector('[data-lu-main]').click(); /* step 4 (skip) -> 5 */
  modal.querySelector('[data-lu-main]').click(); /* step 5 apply */

  assert.equal(doneCalled, true);
  assert.equal(c.level, 5);
  assert.equal(c.hp.active, 7);
  assert.equal(c.hp.max, 7);
  assert.equal(c.hp.current, 7, 'hitPointSlots increase must also heal/fill the newly gained HP slot');
  assert.equal(c.stress.active, 7);
  assert.ok(c.experiences.some(e => e.name === 'Pisteur des ombres'));
});

/* ==================== FAB Smoke & Route/Collapse Tests ==================== */
test('fab: mounts cleanly, reacts to dice/create routes, and toggles mobile collapsed state', async () => {
  globalThis.document.body.children = [];
  const fabMod = await import('../js/fab.js');
  initFab();
  const wrap = globalThis.document.body.querySelector('.d3d-fab-wrap');
  assert.ok(wrap, 'Floating dice menu should mount cleanly');

  fabMod.setFabRoute('dice');
  assert.equal(wrap.classList.contains('on-dice'), true);
  assert.equal(wrap.classList.contains('on-create'), false);

  fabMod.setFabRoute('create');
  assert.equal(wrap.classList.contains('on-dice'), false);
  assert.equal(wrap.classList.contains('on-create'), true);

  const toggle = wrap.querySelector('#d3d-dock-toggle');
  assert.ok(toggle);
  const wasCollapsed = wrap.classList.contains('collapsed');
  toggle.click();
  assert.equal(wrap.classList.contains('collapsed'), !wasCollapsed);
  toggle.click();
  assert.equal(wrap.classList.contains('collapsed'), wasCollapsed);
});

/* ==================== Security Import & XSS Escaping Tests ==================== */
test('security: import validation rejects malformed traits/oversized payloads and escapes rendered DOM sinks', async () => {
  resetTestState();
  assert.throws(() => core.importCharacterFromText(JSON.stringify({ name: 'Bad', traits: [] })), /Format de personnage invalide/);
  assert.throws(() => core.importCharacterFromText('x'.repeat(core.MAX_CHAR_IMPORT_BYTES + 1)), /trop volumineux/);
  assert.throws(() => core.importFullBackupFromText('x'.repeat(core.MAX_BACKUP_IMPORT_BYTES + 1)), /trop volumineuse/);

  const evilBackup = JSON.stringify({
    schema: 'daggerborne-backup-v1',
    data: {
      fear: 99,
      countdowns: [{ id: '" onmouseover="alert(1)', name: '<img src=x onerror=alert(1)>', max: '4" onfocus="', value: 2 }],
      rolls: [{ id: 'r1', t: Date.now(), hope: 10, fear: 4, mod: 0, total: 14, result: 'hope', label: '<script>alert(1)</script>' }],
      encounter: {
        pcCount: 4,
        active: [{
          uid: '" onclick="alert(1)',
          name: '<img src=x onerror=alert(1)>',
          type: '<svg onload=alert(1)>',
          difficulty: '12<script>',
          hpMax: 6,
          hpMarked: '2<img src=x>',
          stressMax: 3,
          stressMarked: 1,
          atkBonus: '+2',
          atkDamage: '1d8+2',
          conditions: [],
        }],
      },
      characters: [{
        id: '" onmouseover="alert(1)',
        name: '<script>alert(1)</script>',
        portrait: 'javascript:alert(1)',
        traits: { agility: 1, strength: 0, finesse: 0, instinct: 0, presence: 0, knowledge: 0 },
        weapons: [{ uid: '" onerror="alert(1)', name: '<b>Dagger</b>', trait: 'agility', range: 'Melee', dice: 'd6" onclick="', dmgType: 'phy', hands: 'one', state: 'active', primary: true }],
        companion: { name: 'Wolf', evasion: '10" onmouseover="', dice: 'd8<img', attackName: 'Bite', range: 'Melee', stress: { max: 3, current: 0 }, experiences: [] },
      }],
    },
  });

  const res = core.importFullBackupFromText(evilBackup, 'replace');
  assert.equal(res.added, 1);
  const st = core.getState();
  assert.equal(st.fear, 30);
  assert.equal(st.characters[0].portrait, '');

  const main = globalThis.document.createElement('main');
  await views.chars.render(main, null);
  assert.ok(!main.innerHTML.includes('<script>alert(1)'), 'chars view must escape script tags');
  assert.ok(!main.innerHTML.includes('javascript:alert(1)'), 'chars view must not render unsafe portrait');
  assert.ok(!main.innerHTML.includes('" onmouseover="alert(1)'), 'chars view must sanitize/escape character id');

  await views.sheet.render(main, st.characters[0].id);
  assert.ok(!main.innerHTML.includes('" onerror="alert(1)'), 'sheet view must sanitize/escape weapon uid');
  assert.ok(!main.innerHTML.includes('d6" onclick="'), 'sheet view must sanitize/escape weapon dice');

  await views.gm.render(main, null);
  assert.ok(!main.innerHTML.includes('<img src=x onerror=alert(1)>'), 'gm countdowns must escape name');
  main.querySelector('[data-gmtab="encounter"]').click();
  await new Promise(r => setTimeout(r, 20));
  assert.ok(!main.innerHTML.includes('<svg onload=alert(1)>'), 'gm encounter must escape type');
  assert.ok(!main.innerHTML.includes('" onclick="alert(1)'), 'gm encounter must sanitize/escape uid');

  await views.dice.render(main, null);
  assert.ok(!main.innerHTML.includes('<script>alert(1)</script>'), 'dice history must escape label');
});

/* ==================== UI/UX & Pre-fill Regression Tests ==================== */
test('ui & sheet: pre-fills class+subclass features, preserves custom edits, switches mobile tabs, and renders GM 12-Fear marker', async () => {
  resetTestState();
  const classes = await core.data('classes', 'fr');
  const subclasses = await core.data('subclasses', 'fr');
  const wizClass = classes[0];
  const wizSub = subclasses.find(s => s.classId === wizClass.id);

  /* Migrate / render new character without classFeature: should auto-fill class features + Foundation */
  const pc = core.newCharacter({
    id: 'prefill-pc',
    name: 'Lyra',
    classId: wizClass.id,
    className: wizClass.fr,
    subclassId: wizSub.id,
    subclassText: wizSub.fr,
  });
  core.saveChar(pc);

  const main = new MockElement('main');
  globalThis.document.body.appendChild(main);
  try {
    await views.sheet.render(main, 'prefill-pc');
    assert.ok(pc.classFeature.includes(wizClass.features[0].name), 'Class feature should be pre-filled from SRD');
    assert.ok(pc.classFeature.includes(wizSub.features[0].name), 'Subclass foundation should be pre-filled from SRD');
    assert.equal(pc.customClassFeature, false);

    /* Switching sheet mobile sub-tabs updates data-mtab */
    const mtabLabels = [...main.querySelectorAll('.dh-mtabs [data-mtab]')].map(b => b.dataset.mtab);
    assert.deepEqual(mtabLabels, ['combat', 'traits', 'cards', 'bag']);
    main.querySelector('.dh-mtabs [data-mtab="traits"]').click();
    assert.equal(main.querySelector('.dh-sheet').dataset.mtab, 'traits');
    main.querySelector('.dh-mtabs [data-mtab="bag"]').click();
    assert.equal(main.querySelector('.dh-sheet').dataset.mtab, 'bag');

    /* Manual edit locks customClassFeature so language toggle preserves player text */
    const cfInput = main.querySelector('[data-f="classFeature"]');
    assert.ok(cfInput);
    cfInput.value = 'Note personnalisée du joueur';
    cfInput.dispatchEvent({ type: 'change', target: cfInput });
    assert.equal(pc.customClassFeature, true);

    i18n.setLang('en');
    await views.sheet.render(main, 'prefill-pc');
    assert.equal(pc.classFeature, 'Note personnalisée du joueur');
    const enMtabs = [...main.querySelectorAll('.dh-mtabs [data-mtab]')].map(b => b.textContent.replaceAll('&amp;', '&'));
    assert.deepEqual(enMtabs, ['Combat', 'Traits & Exp.', 'Cards', 'Bag & Gold']);

    /* GM Fear Pool renders visual marker after 12th hex */
    await views.gm.render(main, null);
    main.querySelector('[data-gmtab="fear"]')?.click();
    await new Promise(r => setTimeout(r, 20));
    assert.ok(main.querySelector('.fear-pip.cap12'), '12th Fear pip should carry .cap12');
    assert.ok(main.querySelector('.fear-cap-sep'), 'Visual separator after 12th Fear pip should render');
  } finally {
    i18n.setLang('fr');
    main.remove();
  }
});

test('regressions: levelup swap cap, mixedAncestry & subcardTaken migration, dice Hope deduction, and GM multi-dice', async () => {
  resetTestState();
  const classes = await core.data('classes', 'fr');
  const subclasses = await core.data('subclasses', 'fr');
  const cards = await core.data('domainCards', 'fr');
  const ancestriesFr = await core.data('ancestries', 'fr');
  const ancestriesEn = await core.data('ancestries', 'en');

  const cl = classes[0];
  const sub = subclasses.find(s => s.classId === cl.id && s.features?.length >= 2) || subclasses.find(s => s.classId === cl.id);
  const lowCard = cards.find(cd => cl.domains.includes(cd.domain) && cd.level === 1);
  assert.ok(cl && sub && lowCard);

  const pc = core.newCharacter({
    id: 'reg-pc',
    name: 'Nyra',
    classId: cl.id,
    className: cl.fr,
    subclassId: sub.id,
    subclassText: sub.fr,
    level: 2,
    hope: { max: 6, current: 1 },
    traits: { agility: 1, strength: 0, finesse: 2, instinct: 0, presence: 0, knowledge: 0 },
    experiences: [{ name: 'Acrobatie', mod: 2 }, { name: '', mod: 2 }, { name: '', mod: 2 }, { name: '', mod: 2 }, { name: '', mod: 2 }],
    subcardTaken: { 2: true },
    mixedAncestry: {
      primaryId: ancestriesFr[0].id,
      secondaryId: ancestriesFr[1].id,
      firstFrom: 1,
    },
    ancestry: {
      id: `${ancestriesFr[0].id}+${ancestriesFr[1].id}`,
      fr: `${ancestriesFr[0].fr}-${ancestriesFr[1].fr}`,
      abilities: [ancestriesFr[0].abilities[0], ancestriesFr[1].abilities[1]],
    },
    domainCards: [{ cardId: lowCard.id, inHand: true }],
  });
  core.saveChar(pc);

  const main = new MockElement('main');
  globalThis.document.body.appendChild(main);
  try {
    /* 1. subcardTaken restores subcardCount & mixedAncestry re-localizes FR -> EN */
    i18n.setLang('en');
    await views.sheet.render(main, 'reg-pc');
    assert.equal(pc.subcardCount, 2, 'subcardTaken should restore subcardCount=2');
    assert.equal(pc.ancestry.fr, `${ancestriesEn[0].fr}-${ancestriesEn[1].fr}`, 'mixedAncestry name must localize to EN');
    assert.equal(pc.ancestry.abilities[0].fr, ancestriesEn[0].abilities[0].fr, 'mixedAncestry ability 1 must localize to EN');
    assert.equal(pc.ancestry.abilities[1].fr, ancestriesEn[1].abilities[1].fr, 'mixedAncestry ability 2 must localize to EN');

    /* 2. dice.js: #roll-char selects/clears character & Experience deducts 1 Hope (and blocks at 0 Hope) */
    i18n.setLang('fr');
    await views.dice.render(main, 'reg-pc');
    const charSel = main.querySelector('#roll-char');
    assert.ok(charSel, '#roll-char selector must render');
    const traitSel = main.querySelector('#roll-trait');
    traitSel.value = 'exp0';
    traitSel.dispatchEvent({ type: 'change', target: traitSel });
    const rollBtn = main.querySelector('#btn-roll');
    const origRand = Math.random;
    Math.random = () => 0.1; /* hope=2, fear=2 -> tie/crit would grant +1 hope, so test different rolls via sequential values */
    let calls = 0;
    Math.random = () => (calls++ % 2 === 0 ? 0.1 : 0.8); /* hope=2, fear=10 -> fear roll (no hope gained back) */
    try {
      rollBtn.click();
      await new Promise(r => setTimeout(r, 30));
    } finally {
      Math.random = origRand;
    }
    assert.equal(pc.hope.current, 0, 'Rolling an Experience on a Fear roll must leave 0 Hope after deducting 1');

    /* Second Experience roll at 0 Hope must be blocked and leave Hope at 0 */
    const traitSel2 = main.querySelector('#roll-trait');
    traitSel2.value = 'exp0';
    traitSel2.dispatchEvent({ type: 'change', target: traitSel2 });
    const rollsBefore = core.getState().rolls.length;
    main.querySelector('#btn-roll').click();
    await new Promise(r => setTimeout(r, 20));
    assert.equal(core.getState().rolls.length, rollsBefore, 'Roll must abort when Hope < 1');

    /* Clearing #roll-char switches back to free roll */
    const charSel2 = main.querySelector('#roll-char');
    charSel2.value = '';
    charSel2.dispatchEvent({ type: 'change', target: charSel2 });
    assert.equal(main.querySelector('#roll-trait'), null, 'Clearing #roll-char must hide character trait selector');

    /* 3. levelup step 4: replacement cards cannot exceed swapped card level */
    await openLevelUp(pc, { onDone: () => {} });
    const modal = globalThis.document.body.querySelector('.dh-lvlup');
    assert.ok(modal);
    modal.querySelector('[data-lu-main]').click(); /* step 1 -> 2 */
    modal.querySelector('[data-luopt="evasion"]').click();
    modal.querySelector('[data-luopt="hitPointSlots"]').click();
    modal.querySelector('[data-lu-main]').click(); /* step 2 -> 3 */
    modal.querySelector('[data-lupick]').click();
    modal.querySelector('[data-lu-main]').click(); /* step 3 -> 4 */
    modal.querySelector('[data-luswap="0"]').click();
    const swapChoices = [...modal.querySelectorAll('[data-lunew]')];
    assert.ok(swapChoices.length > 0, 'Swap choices should list level 1 alternatives');
    for (const btn of swapChoices) {
      assert.ok(btn.textContent.startsWith('Niv. 1'), `Swapping a level 1 card must not offer >1 card: ${btn.textContent}`);
    }
    modal.querySelector('[data-lu-prev]').click(); /* back/close cleanup */

    /* 4. GM encounter rolls multi-dice damage formulas (2d8+1d4+2) */
    core.setState(s => {
      s.encounter.active = [{
        uid: 'adv-multi', name: 'Golem', type: 'Solitaire', tier: 2,
        difficulty: 14, hpMax: 8, hpMarked: 0, stressMax: 4, stressMarked: 0,
        atkBonus: '+3', atkDamage: '2d8+1d4+2', conditions: [],
      }];
    });
    await views.gm.render(main, null);
    main.querySelector('[data-gmtab="encounter"]').click();
    await new Promise(r => setTimeout(r, 20));
    const dmgBtn = main.querySelector('[data-enc-dmg="adv-multi"]');
    assert.ok(dmgBtn);
    dmgBtn.click();
    await new Promise(r => setTimeout(r, 20));
    const lastGmRoll = core.getState().rolls[0];
    assert.equal(lastGmRoll.notation, '2d8+1d4+2', '2d8+1d4+2 must preserve full multi-dice notation');
    assert.ok(lastGmRoll.total >= 5 && lastGmRoll.total <= 22, `Unexpected total: ${lastGmRoll.total}`);
    const gmBannerDetail = globalThis.document.body.querySelector('.d3d-banner .d3d-detail')?.textContent || '';
    assert.ok(gmBannerDetail.includes('2d8+1d4+2') && gmBannerDetail.includes('(+2)'), `Expected 2d8+1d4+2 (+2) detail, got: ${gmBannerDetail}`);
  } finally {
    i18n.setLang('fr');
    main.remove();
  }
});

