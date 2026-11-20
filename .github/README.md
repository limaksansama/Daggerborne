
Daggerborne
Daggerheart · Compagnon — PWA française

Compagnon de jeu Daggerheart : création de personnages guidée pas à pas, dés de Dualité, compendium complet en français et outils du MJ. Fonctionne hors-ligne une fois installée, sur mobile, tablette et ordinateur.
Contenu

    Assistant de création en 9 étapes : Classe → Sous-classe → Ascendance → Communauté → Traits (+2/+1/+1/0/0/−1 avec suggestions de classe) → Équipement (armes filtrées par trait d'Incantation, armures avec seuils) → 2 cartes de domaine de niveau 1 → Expériences → Identité (nom, pronoms, questions de background de la classe)
    Fiche de personnage calquée sur la feuille officielle (layout Daggerheart, thème sombre) :
        En-tête identité : Nom, Pronoms, Héritage, Sous-classe (éditables) + badge Niveau 1–10 avec **assistant de montée de niveau interactif en 5 étapes (★ Monter) conforme au livre de règles (p. 109-111) : Étape 1 — Récompense de palier automatique aux niveaux 2/5/8 (nouvelle Expérience à +2 saisie directement dans l'assistant, +1 Maîtrise, effacement des traits cochés aux niveaux 5/8) ; Étape 2 — 2 améliorations avec compteur de points dynamique et compteurs d'utilisation par option (traits non cochés avec sélecteur intégré, emplacements PV/Stress permanents, +1 à deux Expériences, Évasion, carte de sous-classe améliorée, +1 Maîtrise à double coût — 2 cases liées consommant 2/2 points, multiclassage dès le palier 3) ; Étape 3 — Carte(s) de domaine obligatoire(s) (recherche, filtres par domaine et par niveau, cartes en accordéon avec description complète et coût de rappel, quota 1 → 2 si l'option supplémentaire est prise) ; Étape 4 — Échange facultatif d'une carte possédée contre une autre de niveau égal ou inférieur (1 seul échange) ; Étape 5 — Récapitulatif complet puis application atomique (une seule écriture de sauvegarde). Interface : en-tête fixe avec barre de progression Étape 1/5 → 5/5, corps à défilement unique (aucun double scroll), pied sticky Précédent/Annuler · Suivant/Passer/Appliquer, zones tactiles ≥ 44px, geste retour Android = étape précédente (popstate), seuils de dégâts recalculés automatiquement, max 5 cartes en main. Colonne gauche — Survie & ressources : Dégâts & Santé (3 seuils calculés : base d'armure + niveau + bonus d'aptitudes ; jauges PV et Stress : 6 cases actives + 6 déblocables en pointillés), Espoir (6 losanges + feature d'Espoir), Expériences (5 lignes, modificateur, 🎲 = dépense 1 Espoir + jet), Or (10 poignées / 10 sacs / 1 coffre : pastilles creuses → dorées, compteurs par palier, report automatique au palier supérieur au 11e clic, bouton ⇄ Convertir, total en poignées), Aptitude de classe (zone de texte libre, alimentée par les cartes de sous-classe prises en montée de niveau)
        Colonne droite — Équipement : Armes (maîtrise 1–6 dés, 4 emplacements : switch Portée/Sac, 1 ou 2 mains, Principale/Secondaire, trait, portée, dé de dégâts, 🎲 = dégâts = Maîtrise × dé d'arme), Armure active (nom, seuils et score de base qui alimentent toute la fiche), Inventaire (recherche sur 242 objets, quantités, objets perso)
        Onglet « Plus » : cartes de domaine, aptitudes, background, journal — barre d'onglets stylisée assortie au thème
        Mobile : navigation par onglets Combat / Stats & Ressources / Équipement / Plus
        Export / import JSON du personnage, repos court / long
    Dés de Dualité : deux d12 animés (dé d'Espoir + dé de Peur), avantage (+1d6) / désavantage (−1d6), sélection de trait ou d'Expérience (dépense l'Espoir), succès critique (dés égaux : efface un Stress), gains automatiques d'Espoir/Peur, historique — accessibles depuis la fiche en overlay sans quitter la page
    Compendium : 210 cartes de domaine, 242 objets (butin magique + consommables, avec descriptions FR officielles et ajout direct à l'inventaire), 13 classes, 26 sous-classes, 24 ascendances, 15 communautés, 324 armes, 69 armures, 264 adversaires — recherche et filtres
    Outils du MJ : pool de Peur, comptes à rebours, rappel des actes du MJ
    Réglages → À propos : licence MIT du module Foundry (Foundryborne, © 2025 WBHarry), licence DPCGL (Daggerheart SRD © Critical Role, LLC), crédit de traduction Black Book Éditions

Données en français

    Cœur des règles : termes officiels de la traduction française du Livre de règles Daggerheart (Black Book Éditions) — Dés de Dualité, Espoir/Peur, ascendances, communautés, classes, domaines, 186 cartes de domaine
    242 objets d'inventaire (121 butins magiques + 121 consommables) extraits du module Foundry : noms et descriptions officiels en français depuis le chapitre « Butin » du livre de règles ; les objets du supplément Hope & Fear (non traduit officiellement) gardent leur description anglaise et le badge « H&F »
    Supplément Hope & Fear : 21 cartes du domaine Effroi, classes Assassin/Bagarreur/Occultiste/Sorcière, 6 ascendances et 6 communautés supplémentaires — traductions amateurs marquées « H&F » dans l'app
    Les noms des 264 adversaires restent en anglais (statblocks prêts, traduction à venir)

Installation
Option A — Test immédiat (le plus simple)

Dézippez daggerheart-compagnon-pwa.zip, puis depuis le dossier dézippé :

python3 -m http.server 8080

Ouvrez http://localhost:8080 dans votre navigateur.
Option B — Installation comme application (mobile/tablette)

    Servez le dossier (option A, ou n'importe quel hébergement statique : GitHub Pages, Netlify, Vercel…)
    Ouvrez l'URL dans Safari (iOS) ou Chrome (Android/desktop)
    iOS : bouton Partager → « Sur l'écran d'accueil »
    Android/Chrome : menu ⋮ → « Installer l'application »
    Desktop Chrome/Edge : icône d'installation dans la barre d'adresse

Une fois visitée une première fois, l'application fonctionne 100 % hors-ligne (service worker).

    ⚠️ L'ouverture directe de index.html en file:// ne permet ni le service worker ni l'installation PWA — passez toujours par un serveur HTTP (même local).

Option C — Dossier prêt

Le dossier daggerheart-compagnon/ contient l'application dézippée, prêt à copier sur n'importe quel hébergement statique.
Données & vie privée

Tout est stocké localement dans le navigateur (localStorage) : personnages, jets, pool de Peur, comptes à rebours. Aucune donnée n'est envoyée en ligne. Export/import JSON disponibles (fiche par fiche, ou sauvegarde complète dans Réglages).
Licences

    Code, structure de données, polices (Cinzel, Overpass), icônes et palette : module Foundryborne Daggerheart — Licence MIT, © 2025 WBHarry
    Contenu de jeu : Daggerheart SRD 1.0 © Critical Role, LLC — Darrington Press Community Gaming License
    Termes français : traduction © Black Book Éditions (Livre de règles Daggerheart, 2026)
    Application non officielle, sans affiliation avec Critical Role, Darrington Press, Black Book Éditions ni Foundry Gaming LLC

v25 — Audit SRD 2.0 (source unique : PDF officiel)

Nouveau cette version :

    264 adversaires : statblocks complets extraits du SRD 2.0 (PV, Stress, seuils majeur/grave, ATQ, dégâts, Expérience, motivations & tactiques, features) — consultables dans le Compendium et le nouvel onglet MJ « Bestiaire » (filtres par palier et type).
    47 environnements (Paliers 1–4) : impulsions, adversaires potentiels et features — onglet MJ « Environnements » + Compendium.
    6 transformations (Demi-dieu, Fantôme, Ranimé, Changeur de forme, Vampire, Loup-garou) avec features et questions d'identité — Compendium + champ « Transformation » sur la fiche personnage.
    Référence de règles MJ : conditions, repos/temps morts, création d'affrontements, seuils de dégâts, multiclassage.
    Correction : 33 cartes de domaine avec coût de rappel 0 (conforme SRD), sous-classe « Sorcière des haies » (Witch/Hedge).

Conformité DPCGL 2.0 : source unique = SRD 2.0 officiel (le module Foundry n'est plus utilisé) ; zéro Campaign Frame, zéro illustration officielle, zéro contenu playtest.

État de la traduction : les données SRD proviennent d'un pipeline d'extraction PDF (scripts dans scripts/). La traduction FR est en cours (239/264 descriptions, 287/906 features traduites) ; les textes restants sont en anglais. Relancez la traduction avec python3 scripts/translate-srd.py (reprise sur cache) puis python3 scripts/build-app-data.py.
