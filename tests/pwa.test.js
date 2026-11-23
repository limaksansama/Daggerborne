/* Cohérence de publication PWA : version de cache, ?v= d'index.html,
   format de DATA_VER et couverture du précache du service worker. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function swVersion() {
  const m = read('sw.js').match(/const VERSION = 'daggerborne-v(\d+)'/);
  assert.ok(m, 'sw.js doit définir VERSION = \'daggerborne-vNN\'');
  return m[1];
}

function precacheList() {
  return [...read('sw.js').matchAll(/'\.\/([^']+)'/g)].map((m) => m[1]);
}

test('La version de cache de sw.js est alignée avec les ?v= d\'index.html', () => {
  const version = swVersion();
  const tags = [...read('index.html').matchAll(/\?v=(\d+)/g)].map((m) => m[1]);
  assert.ok(tags.length > 0, 'index.html doit versionner ses assets');
  for (const tag of tags) {
    assert.equal(tag, version, `index.html référence ?v=${tag} alors que sw.js est en v${version}`);
  }
});

test('DATA_VER garde un format de version valide', () => {
  assert.match(read('js/core.js'), /const DATA_VER = 'v\d+'/);
});

test('Toutes les icônes du manifeste sont précachées', () => {
  const manifest = JSON.parse(read('manifest.webmanifest'));
  const cached = new Set(precacheList());
  const missing = manifest.icons.map((icon) => icon.src).filter((src) => !cached.has(src));
  assert.deepEqual(missing, [], `Icônes du manifeste absentes du précache :\n${missing.join('\n')}`);
});

test('Les thèmes de dés sont versionnés, cohérents et précachés', () => {
  const app = read('js/dice3d.js');
  assert.match(app, /preloadThemes: \['nebula-gold-v2', 'hope-v2', 'fear-v2'\]/);
  const cached = new Set(precacheList());
  for (const theme of ['nebula-gold-v2', 'hope-v2', 'fear-v2']) {
    const config = JSON.parse(read(`assets/dice-box/themes/${theme}/theme.config.json`));
    assert.equal(config.systemName, theme);
    assert.ok(cached.has(`assets/dice-box/themes/${theme}/diffuse-light.png`), `Texture ${theme} absente du précache`);
  }
});

test('Tout module local importé est précaché par le service worker', () => {
  const cached = new Set(precacheList());
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name !== 'vendor') walk(rel);
      } else if (entry.name.endsWith('.js')) {
        files.push(rel);
      }
    }
  };
  walk('js');

  const missing = [];
  for (const file of files) {
    for (const m of read(file).matchAll(/from\s+'(\.\.?\/[^']+\.js)'/g)) {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), m[1]));
      if (!cached.has(target)) missing.push(`${target} (importé par ${file})`);
    }
  }
  assert.deepEqual(missing, [], `Modules importés absents du précache :\n${missing.join('\n')}`);
});
