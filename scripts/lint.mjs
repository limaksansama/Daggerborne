#!/usr/bin/env node
/* Vérifie la syntaxe de tous les modules JavaScript de l'application
   (modules ES de js/ hors vendor, service worker et serveur Express). */
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['vendor', 'node_modules', 'android', 'www']);

function collect(dir, out = []) {
  for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) collect(rel, out);
    } else if (entry.name.endsWith('.js')) {
      out.push(rel);
    }
  }
  return out;
}

const files = [...collect('js'), 'sw.js', 'server.js'];
const failures = [];

for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', file], { cwd: ROOT, stdio: 'pipe' });
  } catch (err) {
    const msg = `${err.stderr || err.message}`.toString().split('\n').slice(0, 4).join('\n').trim();
    failures.push(`${file}\n${msg}`);
  }
}

if (failures.length) {
  console.error(`✗ ${failures.length} fichier(s) en erreur de syntaxe :\n\n${failures.join('\n\n')}`);
  process.exit(1);
}

console.log(`✓ syntaxe vérifiée sur ${files.length} fichiers JS`);
