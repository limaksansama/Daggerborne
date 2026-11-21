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
    desc: "Le groupe reprend son souffle. Déplacez gratuitement des cartes de domaine entre votre kit et votre réserve, puis choisissez deux fois un mouvement de temps mort (le même deux fois si vous voulez) : Soigner les blessures (effacez 1d4+Palier PV pour vous ou un allié), Effacer le Stress (effacez 1d4+Palier Stress), Réparer l'armure (effacez 1d4+Palier Emplacements d'armure), Se préparer (gagnez 1 Espoir, ou 2 si vous vous préparez avec un ou plusieurs membres du groupe). Conséquence : le MJ gagne 1d4 Peur. À la fin d'un repos court, les features à usage limité par repos se rechargent et les effets « jusqu'à votre prochain repos » expirent." },
  { name: 'Repos long', tag: 'une nuit',
    desc: "Le groupe fait camp et se repose plusieurs heures. Déplacez gratuitement des cartes de domaine, puis choisissez deux fois : Soigner toutes les blessures (effacez tous vos PV ou ceux d'un allié), Effacer tout le Stress, Réparer toute l'armure (effacez tous les Emplacements d'armure), Se préparer (1 Espoir, ou 2 à plusieurs), Travailler sur un projet (avec l'accord du MJ : projet au long cours sur compte à rebours). Conséquence : le MJ gagne (1d4 + nombre de PJ) Peur et peut avancer un compte à rebours à long terme. Après trois repos courts consécutifs, le suivant doit être un repos long." },
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
  desc: "Comparez les dégâts reçus aux seuils de votre fiche (SRD 2.0, p. 50) : en dessous du seuil Majeur → dégâts Mineurs (marquez 1 PV). Dégâts ≥ seuil Majeur et < Grave → dégâts Majeurs (marquez 2 PV). Dégâts ≥ seuil Grave → dégâts Graves (marquez 3 PV). Règle optionnelle Dégâts Massifs : si les dégâts ≥ 2 × seuil Grave, marquez 4 PV. Avant de marquer les PV, dépensez 1 Emplacement d'armure pour réduire la gravité d'un palier (Grave → Majeur → Mineur → 0 PV), sauf face aux dégâts directs.",
};

export const RULES_DEATH = [
  { name: "Baroud d'honneur", tag: 'héroïque',
    desc: "Votre personnage embrasse la mort et livre une dernière action spectaculaire. Cette action réussit automatiquement sur un Succès Critique (avec accord du MJ), puis votre personnage franchit le voile de la mort." },
  { name: 'Éviter la mort', tag: 'inconscient + cicatrice',
    desc: "Votre personnage tombe inconscient (ne peut agir ni être ciblé) et la situation empire. Il se réveille dès qu'un allié lui rend au moins 1 PV ou après un repos long. Lancez votre dé d'Espoir (1d12) : si le résultat ≤ votre niveau, il reçoit une Cicatrice (rayez définitivement 1 emplacement d'Espoir). Si le dernier emplacement d'Espoir est rayé, son voyage prend fin." },
  { name: 'Tout risquer', tag: '2d12 Dualité',
    desc: "Lancez vos dés de Dualité. Si le dé d'Espoir l'emporte, vous restez debout et effacez un total de PV et/ou Stress égal à la valeur du dé d'Espoir. En cas de double (critique), vous restez debout et restaurez tous vos PV et votre Stress. Si le dé de Peur l'emporte, vous franchissez le voile de la mort." },
];

export const RULES_TEAMWORK = [
  { name: 'Aider un allié', tag: '1 Espoir',
    desc: "Décrivez comment vous assistez un allié sur un jet d'action et lancez 1d6 d'Avantage. Plusieurs alliés peuvent dépenser 1 Espoir chacun pour aider : le PJ actif ajoute uniquement le meilleur dé d'Avantage à son total." },
  { name: 'Jet combiné (Tag Team)', tag: '3 Espoirs · 1×/session',
    desc: "Une fois par session par joueur, dépensez 3 Espoirs pour unir vos actions à celles d'un allié. Chacun effectue son jet d'action, puis le duo choisit quel résultat de dés appliquer aux deux actions. Sur Espoir, tous deux gagnent 1 Espoir ; sur Peur, le MJ gagne 1 Peur par PJ impliqué. En attaque réussie, additionnez les dégâts des deux PJ." },
  { name: 'Jet de groupe', tag: 'Meneur + Réactions',
    desc: "Un PJ désigné mène l'action et effectue le jet d'action. Chaque autre participant décrit sa contribution et fait un jet de réaction : +1 au jet du meneur par réaction réussie, −1 par réaction échouée." },
  { name: 'Jets de réaction', tag: 'Pas d\'Espoir/Peur',
    desc: "Effectué pour résister ou esquiver un danger. Identique à un jet d'action, mais ne génère ni Espoir ni Peur, ne déclenche pas de mouvement du MJ et ne peut pas recevoir « Aider un allié ». Un critique annule tous les effets négatifs." },
];

export const RULES_HAZARDS = [
  { name: 'Dégâts directs, Résistance & Immunité', tag: 'dégâts spéciaux',
    desc: "Résistance : divisez les dégâts du type concerné par 2 (arrondi à l'inférieur) avant de comparer aux seuils et avant d'appliquer l'armure. Immunité : ignore totalement les dégâts de ce type. Dégâts directs : impossibles à réduire en marquant des Emplacements d'armure." },
  { name: 'Chutes & collisions', tag: 'environnement',
    desc: "Chute de portée Très Courte → 1d10+3 dégâts physiques ; Courte → 1d20+5 ; Lointaine / Très Lointaine → 1d100+15 (ou mort à la discrétion du MJ). Collision à grande vitesse → 1d20+5 dégâts physiques directs." },
  { name: 'Combat sous-marin', tag: 'apnée',
    desc: "Attaquer sous l'eau subit un désavantage par défaut. Une créature incapable de respirer sous l'eau suit un compte à rebours standard (3) qui avance à chaque action (et +1 sur échec ou Peur) ; une fois à terme, elle marque 1 Stress à chaque action." },
];

export const RULES_CAMPAIGN_FRAMES = [
  { name: 'Héroïsme du quotidien (Everyday Hero)', tag: 'Moderne / Urbain',
    desc: "Des personnages ordinaires pris dans des enjeux extraordinaires. Utilise un équipement contemporain adapté (armes à feu, matériel urbain, armures légères discrètes) et des menaces ancrées dans la vie quotidienne." },
  { name: 'Western (Frontière)', tag: 'Pistolets & Duels',
    desc: "Armes à feu de Palier 1–4, chevaux/montures et règles dédiées aux duels face à face : un duel met deux adversaires sous tension jusqu'au tir décisif." },
  { name: 'Chasse aux monstres (The Hunt)', tag: '5 temps · Trophées & Forge',
    desc: "Structure en 5 actes (Contrat, Enquête par Indices liminaux, Traque, Affrontement, Épilogue). Les trophées de monstres permettent de forger des armes, armures et potions uniques auprès d'un artisan." },
  { name: 'Exploration par hexagones (Hex Crawl)', tag: 'Voyage · ≈ 38 km / hex',
    desc: "Double carte (clé du MJ / carte des joueurs). En terres sauvages, le groupe est limité à 3 repos courts et ne peut prendre de repos long qu'en refuge ou sanctuaire." },
];
