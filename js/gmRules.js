/* Référence de règles MJ — contenu issu du SRD 2.0 (traduction maison, glossaire verrouillé).
   Exporté comme module simple : le texte vit dans le DOM de l'onglet MJ. */

export const RULES_CONDITIONS = [
  { name: 'Caché', tag: 'standard',
    desc: "Tant que vous êtes hors de vue de tous vos ennemis et qu'ils ne connaissent pas votre position, vous êtes Caché. Tous les jets contre une créature Cachée ont un désavantage. Vous n'êtes plus Caché dès qu'un adversaire se déplace là où il peut vous voir, que vous entrez dans son champ de vision ou que vous faites une attaque." },
  { name: 'Entravé', tag: 'standard',
    desc: "Une créature Entravée ne peut pas se déplacer, mais elle peut encore agir depuis sa position actuelle." },
  { name: 'Vulnérable', tag: 'standard',
    desc: "Tous les jets qui ciblent une créature Vulnérable ont un avantage." },
  { name: 'Temporaire', tag: 'spécial',
    desc: "Une condition ou un effet temporaire peut être effacé en réalisant une action contre lui. Pour un PJ, cela demande normalement un jet d'action réussi avec un trait approprié. Pour un adversaire, le MJ le met sous les projecteurs et décrit comment il s'en libère — pas de jet, mais cela consomme ses projecteurs." },
  { name: 'Conditions spéciales', tag: 'spécial',
    desc: "Elles ne s'effacent que lorsque leurs exigences précises sont remplies (achever une action donnée, utiliser un objet particulier…), décrites dans le texte de l'effet. Sauf indication contraire, une même condition ne peut pas être appliquée deux fois à la même cible." },
];

export const RULES_REST = [
  { name: 'Repos court', tag: '≈ 1 heure',
    desc: "Le groupe reprend son souffle. Déplacez gratuitement des cartes de domaine entre votre kit et votre réserve, puis choisissez deux fois un mouvement de temps mort (le même deux fois si vous voulez) : Soigner les blessures (effacez 1d4+Palier PV pour vous ou un allié), Effacer le Stress (effacez 1d4+Palier Stress), Réparer l'armure (effacez 1d4+Palier Emplacements d'armure), Se préparer (gagnez 1 Espoir, ou 2 si vous vous préparez avec un ou plusieurs membres du groupe). À la fin d'un repos court, les features à usage limité par repos se rechargent et les effets « jusqu'à votre prochain repos » expirent. Un repos court interrompu (ex. attaque) n'accorde aucun bénéfice." },
  { name: 'Repos long', tag: 'une nuit',
    desc: "Le groupe fait camp et se repose plusieurs heures. Déplacez gratuitement des cartes de domaine, puis choisissez deux fois : Soigner toutes les blessures (effacez tous vos PV ou ceux d'un allié), Effacer tout le Stress, Réparer toute l'armure (effacez tous les Emplacements d'armure), Se préparer (1 Espoir, ou 2 à plusieurs), Travailler sur un projet (avec l'accord du MJ : projet au long cours — attribuez-lui un compte à rebours dès le départ ; à chaque fois, avancez automatiquement le compte à rebours ou faites un jet d'action pour l'avancer, au choix du MJ). Un repos long interrompu n'accorde que les bénéfices d'un repos court. Après trois repos courts consécutifs, le suivant doit être un repos long." },
];

export const RULES_ENCOUNTER = {
  points: "Pour planifier un affrontement, démarrez avec [(3 × nombre de PJ en combat) + 2] points de combat, puis ajustez : −1 pour un combat plus facile ou plus court ; −2 si vous utilisez 2 adversaires Solo ou plus ; −2 si vous ajoutez +1d4 (ou +2 fixe) aux jets de dégâts de tous les adversaires ; +1 si vous choisissez un adversaire d'un palier inférieur ; +1 si vous n'incluez aucun Bagarreur, Horde, Chef ou Solo ; +2 pour un combat plus dur ou plus long.",
  spend: [
    "1 point par groupe de Sbires d'une taille égale au groupe de PJ",
    "1 point par adversaire Social ou Soutien",
    "2 points par adversaire Horde, À distance, Rôdeur ou Standard",
    "3 points par adversaire Chef",
    "4 points par adversaire Bagarreur",
    "5 points par adversaire Solo",
  ],
  defeated: "Quand un adversaire marque son dernier PV, il est vaincu : décrivez comment il quitte la scène. Quand tous les adversaires sont vaincus ou n'ont plus moyen de nuire, le combat se termine et les PJ peuvent se reposer.",
};

export const RULES_MULTICLASS = {
  when: "À partir du niveau 5, vous pouvez choisir le multiclassage comme option de montée de niveau. Il coûte deux emplacements de montée de niveau (les deux de ce palier).",
  what: [
    "Choisissez une classe supplémentaire et gagnez sa feature de classe",
    "Choisissez un de ses domaines (vous y avez désormais accès)",
    "Prenez la carte de Fondation d'une de ses sous-classes",
    "Si vos cartes de Fondation indiquent des traits d'Incantation différents, choisissez lequel appliquer lors de vos jets d'Incantation",
    "Rayez l'option « carte de sous-classe améliorée » de ce palier et toutes les autres options « multiclassage » de votre fiche",
  ],
  cards: "Chaque fois que vous pouvez acquérir une nouvelle carte de domaine, vous pouvez choisir une carte de niveau ≤ la moitié de votre niveau actuel (arrondi à l'entier supérieur) dans le domaine choisi lors du multiclassage.",
};

export const RULES_THRESHOLDS = {
  desc: "Comparez les dégâts reçus aux seuils de votre fiche : en dessous du seuil majeur → dégâts mineurs (rien ne se passe). Dégâts ≥ seuil majeur → dégâts majeurs (marquez 1 PV). Dégâts ≥ seuil grave → dégâts graves (marquez 2 PV). Les seuils = base d'armure + niveau du personnage (± bonus d'aptitudes). Les adversaires suivent le même système avec leurs propres seuils.",
};
