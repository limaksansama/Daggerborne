/* Analyse bilingue du coût d'une aptitude / carte de domaine.
   Détecte Espoir/Hope, Stress, fréquence par repos et dés, en FR comme en EN.
   Module pur, sans DOM, pour être testé directement par Node. */

const AMOUNT = '(?:(\\d+)|un|une|a|an)';

const FEAT_RE = {
  hope: new RegExp(`(?:D[ée]pensez?|Spend)\\s+${AMOUNT}\\s*(?:Espoirs?|Hope)`, 'i'),
  stress: new RegExp(`(?:[Mm]arquez|[Cc]ochez|[Mm]ark)\\s+${AMOUNT}\\s*(?:Stress)`, 'i'),
  perRest: /(?:une\s+fois\s+par\s+(?:(?:long\s+)?repos|repos\s+(?:longs?|courts?))|once\s+per\s+(?:long\s+)?rest)/i,
  perLong: /(?:une\s+fois\s+par\s+(?:long\s+repos|repos\s+long)|once\s+per\s+long\s+rest)/i,
  dice: /\b(?:(\d+)\s*)?[dD](4|6|8|10|12|20)(?:\s*\+\s*(\d+))?/g,
};

export function featParse(desc) {
  const d = String(desc || '');
  const out = {};
  const mH = d.match(FEAT_RE.hope);
  if (mH) out.hope = mH[1] ? +mH[1] : 1;
  const mS = d.match(FEAT_RE.stress);
  if (mS) out.stress = mS[1] ? +mS[1] : 1;
  if (FEAT_RE.perRest.test(d)) out.perRest = true;
  if (FEAT_RE.perLong.test(d)) out.perLong = true;
  const dice = [...d.matchAll(FEAT_RE.dice)].map((m) => {
    const qty = m[1] ? +m[1] : 1;
    return `${qty}d${m[2]}${m[3] ? `+${m[3]}` : ''}`;
  });
  if (dice.length) out.dice = [...new Set(dice)].join(' + ');
  return out;
}

export { FEAT_RE };
