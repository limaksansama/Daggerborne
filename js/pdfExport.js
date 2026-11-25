/* Export PDF complet de personnage — remplit les fiches officielles Daggerheart (EN)
   et ajoute un feuillet récapitulatif complet (portrait, cartes de domaine, aptitudes,
   inventaire, background et journal) utilisable 100 % hors-ligne. */

import { armorThresholdBonus, calcDamageSpec, equipmentPenalty, tierOf, nextDieStep } from './rules.js';
import { data as coreData } from './core.js';
import { getLang } from './i18n.js';

export const MAIN_PDF_PATH = 'public/assets/aistudio/Character-Sheets-and-Guides-Daggerheart-Aug252026_419c805c.pdf';
export const HF_PDF_PATH = 'public/assets/aistudio/CharacterGuidesAndSheetsTile_HF_2026-07-23_7532a806.pdf';

const TRAIT_KEYS = ['agility', 'strength', 'finesse', 'instinct', 'presence', 'knowledge'];

/* Correspondance exacte classe -> pages des deux PDF officiels (index base 0). */
export const CLASS_PDF_MAP = {
  bard:     { file: 'main', sheet: 0,  guide: 1,  extra: [] },
  druid:    { file: 'main', sheet: 2,  guide: 5,  extra: [3, 4] },
  guardian: { file: 'main', sheet: 6,  guide: 7,  extra: [] },
  ranger:   { file: 'main', sheet: 8,  guide: 10, extra: [], companionPage: 9 },
  rogue:    { file: 'main', sheet: 11, guide: 12, extra: [] },
  seraph:   { file: 'main', sheet: 13, guide: 14, extra: [] },
  sorcerer: { file: 'main', sheet: 15, guide: 16, extra: [] },
  warrior:  { file: 'main', sheet: 17, guide: 18, extra: [] },
  wizard:   { file: 'main', sheet: 19, guide: 20, extra: [] },
  assassin: { file: 'hf',   sheet: 0,  guide: 1,  extra: [] },
  brawler:  { file: 'hf',   sheet: 2,  guide: 4,  extra: [], martialArtistPage: 3 },
  warlock:  { file: 'hf',   sheet: 5,  guide: 6,  extra: [] },
  witch:    { file: 'hf',   sheet: 7,  guide: 8,  extra: [] },
};

const GENERIC_PDF_ENTRY = { file: 'main', sheet: 21, guide: null, extra: [], isGeneric: true };

/* Normalise le texte pour WinAnsiEncoding (StandardFonts.Helvetica) sans jamais jeter d'erreur. */
export function pdfSafeText(str) {
  if (str === null || str === undefined) return '';
  let s = String(str)
    .replace(/\r\n/g, '\n')
    .replace(/œ/g, 'oe').replace(/Œ/g, 'OE')
    .replace(/æ/g, 'ae').replace(/Æ/g, 'AE')
    .replace(/…/g, '...')
    .replace(/[—–−]/g, '-')
    .replace(/[’‘‚]/g, "'")
    .replace(/[“”„«»]/g, '"')
    .replace(/[✦★☆❖◆◈]/g, '*')
    .replace(/•/g, '-')
    .replace(/✓/g, 'X')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/×/g, 'x')
    .replace(/→/g, '->')
    .replace(/↺|↻|⟲/g, '')
    .replace(/\t/g, '  ');

  /* Garde uniquement les caractères imprimables WinAnsi / Latin-1 courants + sauts de ligne. */
  let out = '';
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    if (ch === '\n' || (cp >= 0x20 && cp <= 0x7E) || (cp >= 0xA0 && cp <= 0xFF)) {
      out += ch;
    }
  }
  return out;
}

export function resolvePdfMapping(c, enClasses = [], enSubclasses = []) {
  const cl = enClasses.find(x => x.id === c.classId);
  const sub = enSubclasses.find(x => x.id === c.subclassId);
  const key = String(cl?.en || c.className || '').trim().toLowerCase();
  const base = CLASS_PDF_MAP[key];
  if (!base) return { ...GENERIC_PDF_ENTRY };

  const extra = [...base.extra];
  const subEn = String(sub?.en || c.subclassName || c.subclassText || '').toLowerCase();
  if (base.companionPage != null && (c.companion || subEn.includes('beastbound') || subEn.includes('maître des bêtes'))) {
    extra.push(base.companionPage);
  }
  if (base.martialArtistPage != null && (subEn.includes('martial') || subEn.includes('arts martiaux'))) {
    extra.push(base.martialArtistPage);
  }
  return { ...base, extra, isGeneric: false };
}

function signed(n) {
  const v = Number(n) || 0;
  return v >= 0 ? `+${v}` : `${v}`;
}

function enRange(r) {
  const map = {
    'Mêlée': 'Melee',
    'Très courte': 'Very Close',
    'Très proche': 'Very Close',
    'Courte': 'Close',
    'Proche': 'Close',
    'Longue': 'Far',
    'Éloignée': 'Far',
    'Très longue': 'Very Far',
    'Très éloignée': 'Very Far',
    'Mêlée/Très courte': 'Melee/Very Close',
  };
  return map[r] || r || '';
}

function resolveBeastformMeta(bfMeta, savedBf, beastforms, traits) {
  if (!bfMeta) return null;
  if (bfMeta.trait !== 'variable' && bfMeta.dmgDice !== 'variable') return bfMeta;
  const baseBf = savedBf?.baseId
    ? beastforms.find(b => b.id === savedBf.baseId && b.trait !== 'variable')
    : null;
  if (baseBf) {
    return {
      ...bfMeta,
      fr: `${bfMeta.fr} (${baseBf.fr})`,
      en: `${bfMeta.en || bfMeta.fr} (${baseBf.en || baseBf.fr})`,
      examples: baseBf.examples || bfMeta.examples,
      trait: baseBf.trait,
      traitBonus: (baseBf.traitBonus || 0) + (bfMeta.traitBonus || 0),
      evasionBonus: (baseBf.evasionBonus || 0) + (bfMeta.evasionBonus || 0),
      range: baseBf.range || bfMeta.range || 'Melee',
      dmgDice: bfMeta.tier >= 4 ? nextDieStep(baseBf.dmgDice) : (baseBf.dmgDice || 'd6'),
      dmgBonus: (baseBf.dmgBonus || 0) + (bfMeta.dmgBonus || 0),
      dmgType: baseBf.dmgType || bfMeta.dmgType || 'phy',
      advantages: baseBf.advantages || bfMeta.advantages || [],
      features: [...(bfMeta.features || []), ...(baseBf.features || [])],
      baseId: baseBf.id,
    };
  }
  const bestTrait = TRAIT_KEYS.reduce((best, k) => ((traits?.[k] || 0) > (traits?.[best] || 0) ? k : best), 'agility');
  return { ...bfMeta, trait: bestTrait, dmgDice: bfMeta.tier >= 4 ? 'd10' : 'd8' };
}

function computeDerived(c, { subclasses, beastforms }) {
  const sub = subclasses.find(s => s.id === c.subclassId);
  const bfMeta = c.beastform?.id ? beastforms.find(b => b.id === c.beastform.id) : null;
  const activeBf = resolveBeastformMeta(bfMeta, c.beastform, beastforms, c.traits);
  const gearPenalty = equipmentPenalty([
    c.armorCard?.feature,
    ...(c.weapons || []).filter(w => (w.state || 'active') === 'active').map(w => w.feature),
  ]);
  const traitBonusOf = (k) => (activeBf && activeBf.trait === k ? (activeBf.traitBonus || 0) : 0);
  const effTrait = (k) => (c.traits?.[k] || 0) + traitBonusOf(k) + (gearPenalty[k] || 0);
  const effEvasion = Math.max(0, (c.evasion || 0) + (activeBf?.evasionBonus || 0) + (gearPenalty.evasion || 0));

  const scTrait = sub?.spellcastTrait || null;
  const spellcastValue = scTrait ? (c.traits?.[scTrait] || 0) : 0;
  const armMax = Math.max(0, Math.min(12, c.armorCard?.baseScore || 0));
  const ab = armorThresholdBonus({
    feature: c.armorCard?.feature || '',
    spellcastValue,
    tier: tierOf(c.level),
    armorMax: armMax,
    armorUsed: c.armorSlots?.used || 0,
  });
  const thrBonus = (c.thresholds?.bonus || 0) + ab.bonus;
  const major = (c.armorCard?.baseMajor || 0) + (c.level || 1) + thrBonus;
  const severe = (c.armorCard?.baseSevere || 0) + (c.level || 1) + thrBonus;

  return { sub, activeBf, gearPenalty, effTrait, effEvasion, armMax, thrBonus, major, severe, ab };
}

/* Découpe une chaîne en lignes tenant dans maxWidth. */
function wrapText(rawText, font, size, maxWidth) {
  const safe = pdfSafeText(rawText);
  if (!safe.trim()) return [];
  const paragraphs = safe.split('\n');
  const lines = [];
  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) {
      lines.push('');
      continue;
    }
    const words = trimmed.split(/\s+/);
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        /* Mot plus large que la colonne : découpe par tranches. */
        if (font.widthOfTextAtSize(word, size) > maxWidth) {
          let chunk = '';
          for (const ch of word) {
            if (font.widthOfTextAtSize(chunk + ch, size) <= maxWidth) {
              chunk += ch;
            } else {
              if (chunk) lines.push(chunk);
              chunk = ch;
            }
          }
          current = chunk;
        } else {
          current = word;
        }
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

/* Ajuste automatiquement la taille jusqu'à minSize, puis tronque proprement avec "...". */
function fitSingleLine(rawText, font, maxWidth, startSize, minSize = 6.5) {
  let text = pdfSafeText(rawText).replace(/\n+/g, ' ').trim();
  if (!text) return { text: '', size: startSize };
  let size = startSize;
  while (size > minSize && font.widthOfTextAtSize(text, size) > maxWidth) {
    size -= 0.5;
  }
  if (font.widthOfTextAtSize(text, size) <= maxWidth) {
    return { text, size };
  }
  while (text.length > 1 && font.widthOfTextAtSize(`${text}...`, size) > maxWidth) {
    text = text.slice(0, -1);
  }
  return { text: `${text.trimEnd()}...`, size };
}

function drawFittedText(page, rawText, { x, y, maxWidth, size, minSize = 6.5, font, color, align = 'left' }) {
  const fitted = fitSingleLine(rawText, font, maxWidth, size, minSize);
  if (!fitted.text) return;
  const w = font.widthOfTextAtSize(fitted.text, fitted.size);
  const drawX = align === 'center'
    ? x + (maxWidth - w) / 2
    : align === 'right'
      ? x + maxWidth - w
      : x;
  page.drawText(fitted.text, { x: drawX, y, size: fitted.size, font, color });
}

function drawRuledLines(page, rawText, linesSpec, { font, size = 8.2, minSize = 6.5, color }) {
  const safe = pdfSafeText(rawText).replace(/\n+/g, ' ').trim();
  if (!safe || !linesSpec.length) return;

  let chosenSize = size;
  let wrapped = [];
  while (chosenSize >= minSize) {
    wrapped = [];
    const words = safe.split(/\s+/);
    let wi = 0;
    for (let li = 0; li < linesSpec.length && wi < words.length; li++) {
      const maxW = linesSpec[li].w;
      let cur = '';
      while (wi < words.length) {
        const cand = cur ? `${cur} ${words[wi]}` : words[wi];
        if (font.widthOfTextAtSize(cand, chosenSize) <= maxW) {
          cur = cand;
          wi++;
        } else {
          if (!cur) {
            /* Mot isolé plus grand que la ligne */
            let part = words[wi];
            while (part.length > 1 && font.widthOfTextAtSize(`${part}...`, chosenSize) > maxW) {
              part = part.slice(0, -1);
            }
            cur = `${part}...`;
            wi++;
          }
          break;
        }
      }
      wrapped.push(cur);
    }
    if (wi >= words.length) break;
    chosenSize -= 0.5;
  }

  /* Si le texte dépasse encore à minSize, ajoute "..." sur la dernière ligne */
  if (chosenSize < minSize) {
    chosenSize = minSize;
    const lastIdx = wrapped.length - 1;
    if (lastIdx >= 0) {
      let last = wrapped[lastIdx];
      const maxW = linesSpec[lastIdx].w;
      while (last.length > 1 && font.widthOfTextAtSize(`${last}...`, chosenSize) > maxW) {
        last = last.slice(0, -1);
      }
      wrapped[lastIdx] = `${last.trimEnd()}...`;
    }
  }

  for (let i = 0; i < wrapped.length && i < linesSpec.length; i++) {
    if (!wrapped[i]) continue;
    page.drawText(wrapped[i], {
      x: linesSpec[i].x,
      y: linesSpec[i].y,
      size: chosenSize,
      font,
      color,
    });
  }
}

/* Dessine une croix nette centrée dans une case [x, y, w, h]. */
function drawCross(page, x, y, w, h, color, thickness = 1.4, pad = 2) {
  page.drawLine({
    start: { x: x + pad, y: y + pad },
    end: { x: x + w - pad, y: y + h - pad },
    thickness,
    color,
  });
  page.drawLine({
    start: { x: x + pad, y: y + h - pad },
    end: { x: x + w - pad, y: y + pad },
    thickness,
    color,
  });
}

function drawCheck(page, x, y, w, h, color, thickness = 1.5) {
  page.drawLine({
    start: { x: x + w * 0.18, y: y + h * 0.48 },
    end: { x: x + w * 0.44, y: y + h * 0.2 },
    thickness,
    color,
  });
  page.drawLine({
    start: { x: x + w * 0.44, y: y + h * 0.2 },
    end: { x: x + w * 0.86, y: y + h * 0.82 },
    thickness,
    color,
  });
}

function englishHeritage(c, enData) {
  const { ancestries: enAnc, communities: enCom } = enData;
  let ancLabel = '';
  if (c.mixedAncestry?.primaryId && c.mixedAncestry?.secondaryId) {
    const a1 = enAnc.find(a => a.id === c.mixedAncestry.primaryId);
    const a2 = enAnc.find(a => a.id === c.mixedAncestry.secondaryId);
    if (a1 && a2) ancLabel = `${a1.en || a1.fr}-${a2.en || a2.fr}`;
  } else if (c.ancestry?.id) {
    const a = enAnc.find(x => x.id === c.ancestry.id);
    if (a) ancLabel = a.en || a.fr;
  }
  const customHeritage = c.heritage && c.heritage !== c.ancestry?.fr ? c.heritage : '';
  const com = c.community?.id ? enCom.find(x => x.id === c.community.id) : null;
  const comLabel = com ? (com.en || com.fr) : (c.community?.fr || '');
  const base = customHeritage || ancLabel || c.heritage || '';
  if (base && comLabel && !base.toLowerCase().includes(comLabel.toLowerCase())) {
    return `${base} / ${comLabel}`;
  }
  return base || comLabel;
}

function localizeWeaponEn(w, enWeapons) {
  const def = w.compendiumId ? enWeapons.find(x => x.id === w.compendiumId) : null;
  const name = !w.customName && def ? (def.en || def.fr) : w.name;
  const feature = !w.customFeature && def ? (def.desc || '') : (w.feature || '');
  const range = enRange(!w.customStats && def ? def.range : w.range);
  const dice = !w.customStats && def ? def.dice : w.dice;
  const dmgBonus = !w.customStats && def ? (def.dmgBonus || 0) : (w.dmgBonus || 0);
  const dmgType = !w.customStats && def ? def.dmgType : w.dmgType;
  const trait = !w.customStats && def ? def.trait : w.trait;
  return { name, feature, range, dice, dmgBonus, dmgType, trait };
}

function localizeArmorEn(armorCard, enArmors) {
  const def = armorCard?.compendiumId ? enArmors.find(x => x.id === armorCard.compendiumId) : null;
  return {
    name: !armorCard?.customName && def ? (def.en || def.fr) : (armorCard?.name || ''),
    feature: !armorCard?.customFeature && def ? (def.desc || '') : (armorCard?.feature || ''),
    baseScore: armorCard?.baseScore || 0,
    baseMajor: armorCard?.baseMajor || 0,
    baseSevere: armorCard?.baseSevere || 0,
  };
}

function stampMainSheetPage(page, c, mapping, enData, derived, { font, fontBold, rgb }) {
  const INK = rgb(0.11, 0.12, 0.22);
  const CRIMSON = rgb(0.56, 0.14, 0.17);
  const GOLD = rgb(0.58, 0.4, 0.08);
  const MUTED = rgb(0.55, 0.56, 0.6);

  const subEn = enData.subclasses.find(s => s.id === c.subclassId);
  const heritage = englishHeritage(c, enData);
  const defaultSubFr = enData.subclassesFr?.find(s => s.id === c.subclassId)?.fr;
  const subclassStr = (c.subclassText && c.subclassText !== defaultSubFr && c.subclassText !== c.subclassName)
    ? c.subclassText
    : (subEn?.en || subEn?.fr || c.subclassText || c.subclassName || '');

  /* En-tête identité + Niveau */
  drawFittedText(page, c.name || 'Unnamed', { x: 210, y: 769, maxWidth: 182, size: 12.5, minSize: 7.5, font: fontBold, color: INK });
  drawFittedText(page, c.pronouns || '', { x: 404, y: 769, maxWidth: 125, size: 10.5, minSize: 7, font, color: INK });
  drawFittedText(page, heritage, { x: 200, y: 749.5, maxWidth: 162, size: 10.5, minSize: 6.8, font, color: INK });
  drawFittedText(page, subclassStr, { x: 374, y: 749.5, maxWidth: 155, size: 10.5, minSize: 6.8, font, color: INK });
  drawFittedText(page, String(c.level || 1), { x: 554, y: 753, maxWidth: 35, size: 16.5, minSize: 11, font: fontBold, color: INK, align: 'center' });

  /* Évasion & Armure */
  drawFittedText(page, String(derived.effEvasion), { x: 19.5, y: 686, maxWidth: 39.8, size: 16, minSize: 10, font: fontBold, color: INK, align: 'center' });
  drawFittedText(page, String(c.armorCard?.baseScore || 0), { x: 85.1, y: 682, maxWidth: 40.7, size: 16, minSize: 10, font: fontBold, color: INK, align: 'center' });

  /* 12 emplacements d'armure (3 colonnes x 4 rangées) */
  const armCols = [135.7, 148.8, 161.8];
  const armRows = [701.3, 686.9, 672.5, 658.1];
  const armUsed = c.armorSlots?.used || 0;
  for (let i = 0; i < 12; i++) {
    const ax = armCols[i % 3];
    const ay = armRows[Math.floor(i / 3)];
    if (i < armUsed) {
      drawCross(page, ax, ay, 10.8, 12, CRIMSON, 1.5, 2.2);
    } else if (i >= derived.armMax) {
      page.drawLine({
        start: { x: ax + 2, y: ay + 2 },
        end: { x: ax + 8.8, y: ay + 10 },
        thickness: 0.75,
        color: MUTED,
      });
    }
  }

  /* 6 Traits & coches d'amélioration */
  const traitBoxesX = [204.5, 272.8, 339.3, 405.9, 474.2, 540.6];
  const markCirclesX = [247.9, 316.2, 382.7, 449.3, 517.6, 584.0];
  TRAIT_KEYS.forEach((k, idx) => {
    const val = derived.effTrait(k);
    drawFittedText(page, signed(val), {
      x: traitBoxesX[idx],
      y: 689,
      maxWidth: 44.5,
      size: 16,
      minSize: 11,
      font: fontBold,
      color: INK,
      align: 'center',
    });
    if (c.traitMarks?.includes(k)) {
      const mx = markCirclesX[idx] + 6.35;
      const my = 712.4 + 6.35;
      page.drawCircle({ x: mx, y: my, size: 4.5, color: CRIMSON });
    }
  });

  /* Seuils de dégâts (dans les deux hexagones séparant Mineur / Majeur / Grave) */
  drawFittedText(page, String(derived.major), { x: 83.4, y: 588.5, maxWidth: 20.9, size: 11, minSize: 7.5, font: fontBold, color: INK, align: 'center' });
  drawFittedText(page, String(derived.severe), { x: 171.5, y: 588.5, maxWidth: 20.9, size: 11, minSize: 7.5, font: fontBold, color: INK, align: 'center' });

  /* PV (cases papier = dégâts marqués = hpMax - hpCurrent) */
  const hpMax = Math.max(0, Math.min(12, c.hp?.max || c.hp?.active || 6));
  const hpMarked = Math.max(0, Math.min(hpMax, hpMax - (c.hp?.current ?? hpMax)));
  for (let i = 0; i < 12; i++) {
    const hx = 37.0 + i * 18.77;
    const hy = 553.8;
    if (i < hpMarked) {
      page.drawRectangle({ x: hx + 1.4, y: hy + 1.2, width: 12.5, height: 5.2, color: CRIMSON });
    } else if (i >= hpMax) {
      drawCross(page, hx, hy, 15.3, 7.6, MUTED, 0.7, 2.2);
    }
  }

  /* Stress (cases cochées = stress.current) */
  const stMax = Math.max(0, Math.min(12, c.stress?.max || c.stress?.active || 6));
  const stMarked = Math.max(0, Math.min(stMax, c.stress?.current || 0));
  for (let i = 0; i < 12; i++) {
    const sx = 62.9 + i * 16.5;
    const sy = 531.7;
    if (i < stMarked) {
      page.drawRectangle({ x: sx + 1.2, y: sy + 1.2, width: 11.0, height: 5.2, color: INK });
    } else if (i >= stMax) {
      drawCross(page, sx, sy, 13.4, 7.6, MUTED, 0.7, 2);
    }
  }

  /* Espoir & Cicatrices (6 losanges) */
  const scars = Math.max(0, Math.min(6, c.scars || 0));
  const hopeCap = Math.max(0, 6 - scars);
  const hopeCur = Math.max(0, Math.min(hopeCap, c.hope?.current || 0));
  for (let i = 0; i < 6; i++) {
    const dx = 39.9 + i * 35.46;
    const dy = 475.3;
    const cx = dx + 7.2;
    const cy = dy + 7.2;
    if (i >= hopeCap) {
      drawCross(page, dx, dy, 14.4, 14.4, CRIMSON, 1.8, 1);
    } else if (i < hopeCur) {
      /* Losange doré rempli */
      const pts = [
        `${cx} ${cy + 5.2}`,
        `${cx + 5.2} ${cy}`,
        `${cx} ${cy - 5.2}`,
        `${cx - 5.2} ${cy}`,
      ];
      page.drawSvgPath(`M ${pts[0]} L ${pts[1]} L ${pts[2]} L ${pts[3]} Z`, { color: GOLD });
    }
  }

  /* Fiche générique : aptitude d'Espoir + aptitudes de classe */
  if (mapping.isGeneric) {
    const hopeText = c.hopeFeature || (c.hopeAbility?.name ? `${c.hopeAbility.name} - ${c.hopeAbility.desc || ''}` : '');
    if (hopeText) {
      const hLines = wrapText(hopeText, font, 7.6, 236).slice(0, 4);
      hLines.forEach((ln, idx) => {
        if (ln) page.drawText(ln, { x: 18, y: 461 - idx * 9, size: 7.6, font, color: INK });
      });
    }
    const cfText = c.classFeature || '';
    if (cfText) {
      const cLines = wrapText(cfText, font, 7.4, 240).slice(0, 20);
      cLines.forEach((ln, idx) => {
        if (ln) page.drawText(ln, { x: 16, y: 218 - idx * 9.5, size: 7.4, font, color: INK });
      });
    }
  }

  /* Expériences (5 lignes principales sur la fiche) */
  const expYs = [394.1, 374.4, 354.7, 335.1, 315.4];
  const exps = Array.isArray(c.experiences) ? c.experiences : [];
  for (let i = 0; i < 5; i++) {
    const exp = exps[i];
    if (!exp) continue;
    const nm = String(exp.name || '').trim();
    if (nm) {
      drawFittedText(page, nm, { x: 17, y: expYs[i] + 3, maxWidth: 193, size: 9, minSize: 6.5, font, color: INK });
      drawFittedText(page, signed(exp.mod ?? 2), { x: 222, y: expYs[i] + 3, maxWidth: 26, size: 9.5, minSize: 7, font: fontBold, color: INK, align: 'center' });
    }
  }

  /* Or (9 poignées + 9 sacs + 1 coffre sur la feuille papier) */
  const gt = c.goldTrack || { handfuls: 0, bags: 0, chests: 0 };
  const handfulXs = [15.5, 27.8, 40.1, 52.7, 65.1, 77.9, 90.2, 102.6, 115.2];
  for (let i = 0; i < Math.min(9, gt.handfuls || 0); i++) {
    page.drawCircle({ x: handfulXs[i] + 3.85, y: 271 + 3.85, size: 2.8, color: GOLD });
  }
  if ((gt.handfuls || 0) >= 10) {
    page.drawText('+1', { x: 121.5, y: 279, size: 6.5, font: fontBold, color: GOLD });
  }
  for (let i = 0; i < Math.min(9, gt.bags || 0); i++) {
    const bx = 133.8 + i * 11.25;
    page.drawCircle({ x: bx + 5.1, y: 268.5 + 5.2, size: 3.3, color: GOLD });
  }
  if ((gt.bags || 0) >= 10) {
    page.drawText('+1', { x: 233, y: 279, size: 6.5, font: fontBold, color: GOLD });
  }
  if ((gt.chests || 0) >= 1) {
    page.drawRectangle({ x: 245.5, y: 271.2, width: 9.4, height: 9.2, color: GOLD });
  }

  /* Maîtrise (6 cercles) */
  const profXs = [439.5, 450.9, 462.4, 473.8, 485.3, 496.7];
  const prof = Math.max(1, Math.min(6, c.proficiency || 1));
  for (let i = 0; i < prof; i++) {
    page.drawCircle({ x: profXs[i] + 4.45, y: 610.6 + 4.45, size: 3.3, color: INK });
  }

  /* Armes actives (Principale & Secondaire) */
  const weapons = Array.isArray(c.weapons) ? c.weapons : [];
  let primaryW = weapons.find(w => w.primary && (w.state || 'active') === 'active') || weapons.find(w => w.primary);
  let secondaryW = weapons.find(w => w !== primaryW && w.secondary && (w.state || 'active') === 'active') || weapons.find(w => w !== primaryW && w.secondary);
  const activePool = weapons.filter(w => w !== primaryW && w !== secondaryW && (w.state || 'active') === 'active');
  if (!primaryW && activePool.length) primaryW = activePool.shift();
  if (!secondaryW && activePool.length && primaryW?.hands !== 'two') secondaryW = activePool.shift();

  const stampWeaponBlock = (w, mainY, feat1Y, feat2Y) => {
    if (!w) return;
    const lw = localizeWeaponEn(w, enData.weapons);
    const spec = calcDamageSpec(prof, lw.dice, lw.dmgBonus);
    const dmgStr = `${spec.normalNotation} ${lw.dmgType === 'mag' ? 'Mag' : 'Phy'}`;
    const traitShort = lw.trait ? lw.trait.slice(0, 3).toUpperCase() : '';
    const trRng = [traitShort, lw.range].filter(Boolean).join(' / ');
    drawFittedText(page, lw.name, { x: 292, y: mainY, maxWidth: 121, size: 8.8, minSize: 6.2, font: fontBold, color: INK });
    drawFittedText(page, trRng, { x: 417, y: mainY, maxWidth: 92, size: 8.2, minSize: 6.0, font, color: INK, align: 'center' });
    drawFittedText(page, dmgStr, { x: 513, y: mainY, maxWidth: 82, size: 8.5, minSize: 6.2, font: fontBold, color: INK, align: 'center' });
    drawRuledLines(page, lw.feature, [
      { x: 292, y: feat1Y, w: 302 },
      { x: 329, y: feat2Y, w: 265 },
    ], { font, size: 7.8, minSize: 6.2, color: INK });
  };

  stampWeaponBlock(primaryW, 583.5, 557.5, 534.2);
  stampWeaponBlock(secondaryW, 490.2, 464.3, 440.2);

  /* Armure active */
  const arm = localizeArmorEn(c.armorCard, enData.armors);
  if (arm.name || arm.baseScore || arm.baseMajor || arm.baseSevere) {
    drawFittedText(page, arm.name || '-', { x: 292, y: 386, maxWidth: 155, size: 8.8, minSize: 6.2, font: fontBold, color: INK });
    drawFittedText(page, `${arm.baseMajor} / ${arm.baseSevere}`, { x: 452, y: 386, maxWidth: 79, size: 8.8, minSize: 6.5, font: fontBold, color: INK, align: 'center' });
    drawFittedText(page, String(arm.baseScore), { x: 535, y: 386, maxWidth: 60, size: 9.2, minSize: 6.5, font: fontBold, color: INK, align: 'center' });
    drawRuledLines(page, arm.feature, [
      { x: 292, y: 359.3, w: 302 },
      { x: 329, y: 336.2, w: 265 },
    ], { font, size: 7.8, minSize: 6.2, color: INK });
  }

  /* Inventaire (5 lignes) */
  const invYs = [288.5, 268.3, 248.1, 227.9, 207.6];
  const inv = Array.isArray(c.inventory) ? c.inventory : [];
  const maxShowInv = inv.length > 5 ? 4 : 5;
  for (let i = 0; i < Math.min(maxShowInv, inv.length); i++) {
    const it = inv[i];
    const enItem = it.itemId ? enData.generalItems.find(g => g.id === it.itemId) : null;
    const itemName = enItem ? (enItem.en || enItem.fr) : it.name;
    const label = (it.qty ?? 1) > 1 ? `${itemName} (x${it.qty})` : itemName;
    drawFittedText(page, label, { x: 292, y: invYs[i], maxWidth: 302, size: 8.4, minSize: 6.4, font, color: INK });
  }
  if (inv.length > 5) {
    drawFittedText(page, `(+${inv.length - 4} more items - see Folio page)`, { x: 292, y: invYs[4], maxWidth: 302, size: 7.6, minSize: 6.2, font, color: MUTED });
  }

  /* Armes d'inventaire (jusqu'à 2 emplacements en bas à droite) */
  const invWeapons = weapons.filter(w => w !== primaryW && w !== secondaryW).slice(0, 2);
  if (invWeapons[0]) {
    stampWeaponBlock(invWeapons[0], 162, 136.2, 114.2);
    if (invWeapons[0].primary) drawCross(page, 499.1, 178.2, 7.2, 7.2, INK, 1.3, 1.2);
    if (invWeapons[0].secondary) drawCross(page, 549.0, 178.2, 7.2, 7.2, INK, 1.3, 1.2);
  }
  if (invWeapons[1]) {
    stampWeaponBlock(invWeapons[1], 71.4, 45.6, 23.6);
    if (invWeapons[1].primary) drawCross(page, 499.1, 87.7, 7.2, 7.2, INK, 1.3, 1.2);
    if (invWeapons[1].secondary) drawCross(page, 549.0, 87.7, 7.2, 7.2, INK, 1.3, 1.2);
  }
}

function stampCompanionPage(page, c, { font, fontBold, rgb }) {
  const comp = c.companion;
  if (!comp) return;
  const INK = rgb(0.11, 0.12, 0.22);
  const CRIMSON = rgb(0.56, 0.14, 0.17);

  const nameLabel = comp.species ? `${comp.name || 'Companion'} (${comp.species})` : (comp.name || 'Companion');
  drawFittedText(page, nameLabel, { x: 180, y: 712, maxWidth: 292, size: 11, minSize: 7, font: fontBold, color: INK });
  drawFittedText(page, String(comp.evasion ?? 10), { x: 500, y: 743, maxWidth: 40, size: 15, minSize: 10, font: fontBold, color: INK, align: 'center' });

  /* Expériences du compagnon (jusqu'à 5 lignes) */
  const cExpYs = [429, 409.4, 389.7, 370, 350.4];
  (comp.experiences || []).slice(0, 5).forEach((e, i) => {
    if (!e?.name?.trim()) return;
    drawFittedText(page, e.name, { x: 173, y: cExpYs[i], maxWidth: 194, size: 8.8, minSize: 6.5, font, color: INK });
    drawFittedText(page, signed(e.mod ?? 2), { x: 372, y: cExpYs[i], maxWidth: 42, size: 9, minSize: 7, font: fontBold, color: INK, align: 'center' });
  });

  /* Attaque standard, portée, dé de dégâts */
  const atkLabel = [comp.attackName || '', enRange(comp.range || '')].filter(Boolean).join(' / ');
  drawFittedText(page, atkLabel, { x: 162, y: 256.5, maxWidth: 170, size: 8.5, minSize: 6.2, font: fontBold, color: INK });
  const dieXs = { d6: 172.9, d8: 203.4, d10: 233.9, d12: 264.4 };
  const dx = dieXs[String(comp.dice || 'd6').toLowerCase()] ?? dieXs.d6;
  page.drawCircle({ x: dx + 3, y: 233.1, size: 3.4, color: INK });
  page.drawText(comp.dmgType === 'mag' ? 'MAG' : 'PHY', { x: 293, y: 239, size: 6.8, font: fontBold, color: CRIMSON });

  /* Cases de Stress du compagnon (3 de base + bonus éventuel) */
  const stMax = Math.max(3, Math.min(8, comp.stress?.max || 3));
  const stCur = Math.max(0, Math.min(stMax, comp.stress?.current || 0));
  for (let i = 0; i < stCur; i++) {
    const sx = 207.5 + i * 20.15;
    if (i < 3) {
      page.drawRectangle({ x: sx + 1.5, y: 129.6, width: 16.2, height: 5.2, color: INK });
    } else {
      page.drawRectangle({ x: sx + 1.5, y: 129.6, width: 14, height: 5.2, color: INK });
    }
  }
}

function stampGuidePage(page, c, { font, fontBold, rgb }) {
  const { width, height } = page.getSize();
  /* Certaines pages de guide ont 8.504 pt de fond perdu sur chaque bord (629.008 x 809.008). */
  const ox = (width - 612) / 2;
  const oy = (height - 792) / 2;
  const INK = rgb(0.11, 0.12, 0.22);
  const CRIMSON = rgb(0.56, 0.14, 0.17);

  /* Cases d'évolution Tier 2 / Tier 3 / Tier 4 (d'après c.tierUses[tier]). */
  const tierColX = { 2: 15.6, 3: 219.9, 4: 426.7 };
  const rowSpecs = {
    attributes:    { y: 235.5, offsets: [0, 11.4, 22.8] },
    hitPointSlots: { y: 215.3, offsets: [11.4, 22.8] },
    stressSlots:   { y: 203.0, offsets: [11.4, 22.8] },
    experiences:   { y: 190.8, offsets: [22.8] },
    domainCard:    { y: 170.5, offsets: [22.8] },
    evasion:       { y: 142.2, offsets: [22.8], y2: 141.7 },
    subclass:      { y: 130.0, offsets: [22.8], minTier: 3 },
    proficiency:   { y: 105.2, offsets: [10.5, 21.8], minTier: 3, doubleCost: true },
    multiclass:    { y: 88.9,  offsets: [10.5, 21.8], minTier: 3, doubleCost: true },
  };

  for (const tier of [2, 3, 4]) {
    const uses = c.tierUses?.[tier] || c.tierUses?.[String(tier)];
    if (!uses) continue;
    const baseX = tierColX[tier];
    for (const [optKey, spec] of Object.entries(rowSpecs)) {
      if (spec.minTier && tier < spec.minTier) continue;
      let count = Number(uses[optKey]) || 0;
      if (count <= 0) continue;
      if (spec.doubleCost) count = Math.min(2, count * 2);
      const y = (tier === 2 && spec.y2 !== undefined) ? spec.y2 : spec.y;
      for (let i = 0; i < Math.min(spec.offsets.length, count); i++) {
        drawCheck(page, ox + baseX + spec.offsets[i], oy + y, 9.2, 9.2, CRIMSON, 1.6);
      }
    }
  }

  /* Bandeau discret en haut avec nom/niveau pour identifier les feuillets imprimés */
  drawFittedText(page, `${c.name || 'Character'} - Lv. ${c.level || 1}`, {
    x: ox + 20, y: oy + 772, maxWidth: 260, size: 8, minSize: 6.5, font: fontBold, color: INK,
  });
}

function drawFolioHeader(page, { title, subtitle, font, fontBold, rgb }) {
  const DARK = rgb(0.11, 0.12, 0.22);
  const GOLD = rgb(0.58, 0.4, 0.08);
  const MUTED = rgb(0.42, 0.44, 0.52);

  page.drawRectangle({ x: 36, y: 742, width: 540, height: 2, color: GOLD });
  page.drawText(pdfSafeText(title), { x: 36, y: 754, size: 15, font: fontBold, color: DARK });
  if (subtitle) {
    drawFittedText(page, subtitle, { x: 36, y: 728, maxWidth: 420, size: 9, minSize: 7, font, color: MUTED });
  }
}

async function appendSummaryFolioPages(outPdf, c, derived, { enData, activeData, lang, font, fontBold, rgb }) {
  const INK = rgb(0.12, 0.13, 0.22);
  const MUTED = rgb(0.42, 0.44, 0.52);
  const GOLD = rgb(0.58, 0.4, 0.08);
  const CRIMSON = rgb(0.56, 0.14, 0.17);
  const RULE = rgb(0.84, 0.84, 0.87);
  const CARD_BG = rgb(0.96, 0.96, 0.98);

  const isEn = lang === 'en';
  const Lbl = isEn ? {
    folioTitle: 'Complete Character Folio',
    summary: 'Character Status & Traits',
    abilities: 'Class, Subclass & Heritage Abilities',
    domainCards: 'Domain Cards',
    inHand: 'Loadout (In Hand)',
    inVault: 'Vault',
    empty: 'None',
    recall: 'Recall',
    tokens: 'Tokens',
    inventory: 'Full Inventory',
    extraExp: 'Additional Experiences',
    background: 'Background Questions & Answers',
    notes: 'Character Notes',
    journal: 'Session Journal',
    pageOf: 'Page',
  } : {
    folioTitle: 'Dossier Complet du Personnage',
    summary: 'État du personnage & Détails',
    abilities: 'Aptitudes de classe, sous-classe & héritage',
    domainCards: 'Cartes de domaine',
    inHand: 'En main',
    inVault: 'Caveau',
    empty: 'Aucune',
    recall: 'Rappel',
    tokens: 'Jetons',
    inventory: 'Inventaire complet',
    extraExp: 'Expériences supplémentaires',
    background: 'Questions de background & Réponses',
    notes: 'Notes du personnage',
    journal: 'Journal de bord',
    pageOf: 'Page',
  };

  let page = outPdf.addPage([612, 792]);
  const folioPages = [page];
  let cursorY = 716;
  const LEFT = 36;
  const RIGHT = 576;
  const WIDTH = RIGHT - LEFT;

  const clActive = activeData.classes.find(x => x.id === c.classId);
  const classDisplay = clActive?.fr || c.className || '';
  drawFolioHeader(page, {
    title: `${c.name || (isEn ? 'Unnamed' : 'Sans nom')} — ${Lbl.folioTitle}`,
    subtitle: `${classDisplay}${c.subclassText ? ' (' + c.subclassText + ')' : ''} · ${isEn ? 'Lv.' : 'Niv.'} ${c.level || 1} · ${new Date().toLocaleDateString(isEn ? 'en-US' : 'fr-FR')}`,
    font,
    fontBold,
    rgb,
  });

  /* Portrait (si JPEG ou PNG valide) en haut à droite de la première page de dossier */
  let portraitBottomY = 792;
  if (typeof c.portrait === 'string' && c.portrait.startsWith('data:image/')) {
    try {
      const m = c.portrait.match(/^data:image\/(jpeg|jpg|png);base64,([A-Za-z0-9+/=]+)$/i);
      if (m) {
        const binStr = atob(m[2]);
        const bytes = new Uint8Array(binStr.length);
        for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
        const img = m[1].toLowerCase() === 'png'
          ? await outPdf.embedPng(bytes)
          : await outPdf.embedJpg(bytes);
        const maxBox = 74;
        const scale = Math.min(maxBox / img.width, maxBox / img.height);
        const iw = img.width * scale;
        const ih = img.height * scale;
        page.drawRectangle({ x: RIGHT - iw - 2, y: 774 - ih - 2, width: iw + 4, height: ih + 4, borderColor: GOLD, borderWidth: 1, color: CARD_BG });
        page.drawImage(img, { x: RIGHT - iw, y: 774 - ih, width: iw, height: ih });
        portraitBottomY = 774 - ih - 12;
      }
    } catch {
      /* Portrait corrompu ou WebP ignoré sans bloquer l'export */
    }
  }

  const newPage = (contTitle) => {
    page = outPdf.addPage([612, 792]);
    folioPages.push(page);
    drawFolioHeader(page, {
      title: `${c.name || (isEn ? 'Unnamed' : 'Sans nom')} — ${contTitle || Lbl.folioTitle}`,
      subtitle: '',
      font,
      fontBold,
      rgb,
    });
    cursorY = 720;
  };

  const ensureSpace = (needed, contTitle) => {
    if (cursorY - needed < 42) newPage(contTitle);
  };

  const drawSectionTitle = (title) => {
    ensureSpace(28, title);
    cursorY -= 6;
    page.drawText(pdfSafeText(title), { x: LEFT, y: cursorY, size: 11, font: fontBold, color: CRIMSON });
    cursorY -= 4;
    page.drawRectangle({ x: LEFT, y: cursorY, width: WIDTH, height: 0.9, color: RULE });
    cursorY -= 12;
  };

  const drawParagraph = (text, { size = 8.6, bold = false, color = INK, indent = 0, lineGap = 11.5 } = {}) => {
    const f = bold ? fontBold : font;
    const w = WIDTH - indent;
    const lines = wrapText(text, f, size, w);
    for (const ln of lines) {
      if (ln === '') {
        cursorY -= lineGap * 0.45;
        continue;
      }
      ensureSpace(lineGap + 4);
      page.drawText(ln, { x: LEFT + indent, y: cursorY, size, font: f, color });
      cursorY -= lineGap;
    }
  };

  /* 1. État & Statistiques */
  drawSectionTitle(Lbl.summary);
  const summaryWidth = cursorY > portraitBottomY ? WIDTH - 86 : WIDTH;
  const gt = c.goldTrack || { handfuls: 0, bags: 0, chests: 0 };
  const totalHandfuls = (gt.handfuls || 0) + (gt.bags || 0) * 10 + (gt.chests || 0) * 100;
  const condStr = (c.conditions && c.conditions.length) ? c.conditions.join(', ') : (isEn ? 'None' : 'Aucun');
  const mcClass = c.multiclassClassId ? activeData.classes.find(x => x.id === c.multiclassClassId) : null;
  const extraDomNames = (c.extraDomains || []).map(d => activeData.domains[d]?.fr || d);

  const summaryRows = [
    `${isEn ? 'Evasion' : 'Évasion'}: ${derived.effEvasion}  |  ${isEn ? 'Armor' : 'Armure'}: ${c.armorSlots?.used || 0}/${derived.armMax}  |  ${isEn ? 'Thresholds' : 'Seuils'}: ${derived.major}/${derived.severe}  |  ${isEn ? 'Proficiency' : 'Maîtrise'}: ${c.proficiency || 1}`,
    `${isEn ? 'HP' : 'PV'}: ${c.hp?.current ?? 0}/${c.hp?.max ?? 6}  |  Stress: ${c.stress?.current ?? 0}/${c.stress?.max ?? 6}  |  ${isEn ? 'Hope' : 'Espoir'}: ${c.hope?.current ?? 0}/${Math.max(0, 6 - (c.scars || 0))}  |  ${isEn ? 'Scars' : 'Cicatrices'}: ${c.scars || 0}  |  ${isEn ? 'Short rests' : 'Repos courts'}: ${c.shortRestsSinceLong || 0}`,
    `${isEn ? 'Conditions' : 'États'}: ${condStr}  |  ${isEn ? 'Gold' : 'Or'}: ${gt.handfuls || 0} ${isEn ? 'handfuls' : 'poignées'}, ${gt.bags || 0} ${isEn ? 'bags' : 'sacs'}, ${gt.chests || 0} ${isEn ? 'chest' : 'coffre'} (${totalHandfuls} ${isEn ? 'total' : 'au total'})`,
  ];
  if (c.transformation) summaryRows.push(`${isEn ? 'Transformation' : 'Transformation'}: ${c.transformation}`);
  if (mcClass) {
    summaryRows.push(`${isEn ? 'Multiclass' : 'Multiclassage'}: ${mcClass.fr}${extraDomNames.length ? ` (${extraDomNames.join(', ')})` : ''}`);
  }
  if (derived.activeBf) {
    summaryRows.push(`${isEn ? 'Active Beastform' : 'Forme bestiale active'}: ${derived.activeBf.fr} (${derived.activeBf.trait} +${derived.activeBf.traitBonus || 0}, Evasion +${derived.activeBf.evasionBonus || 0}, ${derived.activeBf.dmgDice})`);
  }

  for (const row of summaryRows) {
    const lines = wrapText(row, font, 8.6, summaryWidth);
    for (const ln of lines) {
      ensureSpace(12);
      page.drawText(ln, { x: LEFT, y: cursorY, size: 8.6, font, color: INK });
      cursorY -= 11.5;
    }
  }
  cursorY = Math.min(cursorY, portraitBottomY);

  /* 2. Aptitudes de classe, d'Espoir, de sous-classe et d'héritage */
  const hasAbilityContent = c.hopeFeature || c.classFeature || c.ancestry?.abilities?.length || c.community?.ability;
  if (hasAbilityContent) {
    drawSectionTitle(Lbl.abilities);
    if (c.hopeFeature) {
      drawParagraph(`${isEn ? 'Hope Feature' : "Aptitude d'Espoir"}: ${c.hopeFeature}`, { size: 8.5, bold: false, lineGap: 11.2 });
      cursorY -= 3;
    }
    if (c.classFeature) {
      drawParagraph(c.classFeature, { size: 8.4, lineGap: 11 });
      cursorY -= 3;
    }
    if (c.ancestry?.abilities?.length) {
      const ancName = c.ancestry.fr || '';
      for (const ab of c.ancestry.abilities) {
        const abLabel = `${ancName ? ancName + ' — ' : ''}${ab.fr || ab.en || ''}`;
        drawParagraph(`${abLabel}: ${ab.desc || ''}`, { size: 8.3, lineGap: 10.8 });
      }
      cursorY -= 2;
    }
    if (c.community?.ability) {
      const ca = c.community.ability;
      const caName = typeof ca === 'string' ? '' : (ca.fr || ca.en || '');
      const caDesc = typeof ca === 'string' ? ca : (ca.desc || '');
      drawParagraph(`${c.community.fr || ''}${caName ? ' — ' + caName : ''}: ${caDesc}`, { size: 8.3, lineGap: 10.8 });
    }
  }

  /* 3. Cartes de domaine (Main + Caveau avec description complète) */
  if (c.domainCards?.length) {
    drawSectionTitle(`${Lbl.domainCards} (${c.domainCards.length})`);
    const ordered = [
      ...c.domainCards.filter(x => x.inHand).map(x => ({ ...x, loc: Lbl.inHand })),
      ...c.domainCards.filter(x => !x.inHand).map(x => ({ ...x, loc: Lbl.inVault })),
    ];
    for (const dc of ordered) {
      const card = activeData.cards.find(x => x.id === dc.cardId);
      if (!card) continue;
      const domName = activeData.domains[card.domain]?.fr || card.domain;
      const tok = c.cardTokens?.[dc.cardId] || 0;
      const header = `[${dc.loc}] ${card.fr} — ${domName} · ${isEn ? 'Lv.' : 'Niv.'} ${card.level} · ${Lbl.recall}: ${card.recall ?? 0}${tok ? ` · ${Lbl.tokens}: ${tok}` : ''}`;
      const descLines = wrapText(card.desc || '', font, 8.1, WIDTH - 14);
      const blockH = 14 + descLines.length * 10.5 + 8;
      ensureSpace(Math.min(blockH, 90), Lbl.domainCards);
      drawParagraph(header, { size: 8.8, bold: true, color: DARK_TITLE_SAFE(INK), lineGap: 11.5 });
      drawParagraph(card.desc || '', { size: 8.1, color: INK, indent: 8, lineGap: 10.5 });
      cursorY -= 3;
    }
  }

  /* 4. Inventaire complet */
  if (c.inventory?.length) {
    drawSectionTitle(`${Lbl.inventory} (${c.inventory.length})`);
    for (const it of c.inventory) {
      const title = `${it.name || '-'}${(it.qty ?? 1) > 1 ? ` (x${it.qty})` : ''}`;
      drawParagraph(it.desc ? `- ${title} — ${it.desc}` : `- ${title}`, { size: 8.3, lineGap: 10.8 });
    }
  }

  /* 5. Expériences 6+ */
  const extraExps = (c.experiences || []).slice(5).filter(e => e?.name?.trim());
  if (extraExps.length) {
    drawSectionTitle(Lbl.extraExp);
    for (const e of extraExps) {
      drawParagraph(`- ${e.name} (${signed(e.mod ?? 2)})`, { size: 8.5, lineGap: 11 });
    }
  }

  /* 6. Background Q&A */
  const bgEntries = Object.entries(c.backgroundAnswers || {}).filter(([, v]) => String(v || '').trim());
  if (bgEntries.length) {
    drawSectionTitle(Lbl.background);
    const questions = clActive?.questions || [];
    for (const [k, ans] of bgEntries) {
      const qIdx = parseInt(k, 10);
      const qLabel = Number.isInteger(qIdx) && questions[qIdx] ? questions[qIdx] : `${isEn ? 'Question' : 'Question'} ${k}`;
      drawParagraph(qLabel, { size: 8.4, bold: true, color: MUTED, lineGap: 10.8 });
      drawParagraph(ans, { size: 8.4, indent: 8, lineGap: 11 });
      cursorY -= 2;
    }
  }

  /* 7. Notes & Journal */
  if (String(c.notes || '').trim()) {
    drawSectionTitle(Lbl.notes);
    drawParagraph(c.notes, { size: 8.5, lineGap: 11.2 });
  }
  if (Array.isArray(c.journal) && c.journal.length) {
    drawSectionTitle(Lbl.journal);
    for (const j of c.journal) {
      const head = j.date ? `[${j.date}]` : '-';
      drawParagraph(`${head} ${j.text || ''}`, { size: 8.4, lineGap: 11 });
      cursorY -= 2;
    }
  }

  /* Pied de page sur chaque feuillet du dossier */
  folioPages.forEach((fp, i) => {
    const footerStr = `Daggerborne — ${c.name || ''} — ${Lbl.pageOf} ${i + 1}/${folioPages.length}`;
    drawFittedText(fp, footerStr, { x: LEFT, y: 20, maxWidth: WIDTH, size: 7.5, minSize: 6.5, font, color: MUTED, align: 'center' });
  });
}

function DARK_TITLE_SAFE(c) {
  return c;
}

/* Charge les deux PDF et assemble le PDF complet prêt au téléchargement. */
export async function exportCharacterPdf(c, opts = {}) {
  const pdfLib = opts.pdfLib || await import('./vendor/pdf-lib.esm.min.js');
  const { PDFDocument, StandardFonts, rgb } = pdfLib;
  const loadBytes = opts.loadBytes || (async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Impossible de charger ${url} (${res.status})`);
    return new Uint8Array(await res.arrayBuffer());
  });
  const loadData = opts.dataLoader || coreData;
  const lang = opts.lang || getLang();

  const [
    enClasses, enSubclasses, enWeapons, enArmors, enAncestries, enCommunities, enGeneralItems, enBeastforms,
    frSubclasses,
    actClasses, actSubclasses, actCards, actDomains,
  ] = await Promise.all([
    loadData('classes', 'en'),
    loadData('subclasses', 'en'),
    loadData('weapons', 'en'),
    loadData('armors', 'en'),
    loadData('ancestries', 'en'),
    loadData('communities', 'en'),
    loadData('generalItems', 'en'),
    loadData('beastforms', 'en'),
    loadData('subclasses', 'fr'),
    loadData('classes', lang),
    loadData('subclasses', lang),
    loadData('domainCards', lang),
    loadData('domains', lang),
  ]);

  const mapping = resolvePdfMapping(c, enClasses, enSubclasses);
  const mainBytes = await loadBytes(MAIN_PDF_PATH);
  const mainPdf = await PDFDocument.load(mainBytes);
  const srcPdf = mapping.file === 'hf'
    ? await PDFDocument.load(await loadBytes(HF_PDF_PATH))
    : mainPdf;

  const outPdf = await PDFDocument.create();
  const font = await outPdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await outPdf.embedFont(StandardFonts.HelveticaBold);

  const enData = {
    classes: enClasses,
    subclasses: enSubclasses,
    subclassesFr: frSubclasses,
    weapons: enWeapons,
    armors: enArmors,
    ancestries: enAncestries,
    communities: enCommunities,
    generalItems: enGeneralItems,
    beastforms: enBeastforms,
  };
  const activeData = {
    classes: actClasses,
    subclasses: actSubclasses,
    cards: actCards,
    domains: actDomains,
  };
  const derived = computeDerived(c, { subclasses: enSubclasses, beastforms: enBeastforms });

  /* 1. Page principale de la fiche de personnage (EN officielle pré-remplie) */
  const [sheetPage] = await outPdf.copyPages(srcPdf, [mapping.sheet]);
  outPdf.addPage(sheetPage);
  stampMainSheetPage(sheetPage, c, mapping, enData, derived, { font, fontBold, rgb });

  /* 2. Pages spéciales éventuelles (Formes bestiales Druide, Compagnon Rôdeur, Martial Artist Brawler) */
  if (mapping.extra.length) {
    const copiedExtras = await outPdf.copyPages(srcPdf, mapping.extra);
    copiedExtras.forEach((ep, idx) => {
      outPdf.addPage(ep);
      const srcIdx = mapping.extra[idx];
      if (mapping.companionPage != null && srcIdx === mapping.companionPage && c.companion) {
        stampCompanionPage(ep, c, { font, fontBold, rgb });
      }
      if (mapping.file === 'main' && (srcIdx === 3 || srcIdx === 4) && derived.activeBf) {
        const bfTier = derived.activeBf.tier || 1;
        const onPage = (srcIdx === 3 && bfTier <= 2) || (srcIdx === 4 && bfTier >= 3);
        if (onPage) {
          const bfText = `ACTIVE BEASTFORM: ${derived.activeBf.en || derived.activeBf.fr} (${derived.activeBf.trait} +${derived.activeBf.traitBonus || 0}, Evasion +${derived.activeBf.evasionBonus || 0}, ${derived.activeBf.dmgDice})`;
          ep.drawRectangle({ x: 36, y: 762, width: 540, height: 18, color: rgb(0.96, 0.94, 0.9), borderColor: rgb(0.56, 0.14, 0.17), borderWidth: 1 });
          drawFittedText(ep, bfText, { x: 42, y: 767, maxWidth: 528, size: 9, minSize: 6.5, font: fontBold, color: rgb(0.56, 0.14, 0.17), align: 'center' });
        }
      }
    });
  }

  /* 3. Page Guide de classe (cases Tier 2-4 cochées) */
  if (mapping.guide !== null && mapping.guide !== undefined) {
    const [guidePage] = await outPdf.copyPages(srcPdf, [mapping.guide]);
    outPdf.addPage(guidePage);
    stampGuidePage(guidePage, c, { font, fontBold, rgb });
  }

  /* 4. Dossier complet (portrait, aptitudes, toutes cartes de domaine, inventaire, notes, journal) */
  await appendSummaryFolioPages(outPdf, c, derived, { enData, activeData, lang, font, fontBold, rgb });

  const slug = (c.name || 'character')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-+|-+$/g, '') || 'character';

  const bytes = await outPdf.save();
  return {
    bytes,
    filename: `daggerborne-${slug}.pdf`,
    pageCount: outPdf.getPageCount(),
    mapping,
  };
}
