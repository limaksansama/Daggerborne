Daggerborne
Compagnon de jeu français pour Daggerheart (PWA hors-ligne)
Une application web tout-en-un pour créer vos personnages, lancer vos dés de Dualité et gérer vos parties de Daggerheart sur mobile, tablette ou ordinateur. Une fois ouverte une première fois, elle fonctionne 100 % hors-ligne et ne nécessite aucun compte.
Ce que fait l'application
Création & Fiche de personnage
 * Assistant en 9 étapes : laissez-vous guider de l'ascendance jusqu'aux questions de background, avec suggestions automatiques selon la classe.
 * Fiche interactive : reprenant la mise en page officielle en thème sombre. Gérez vos PV, Stress, Espoir, Or (avec conversion automatique poignées/sacs/coffres) et seuils de dégâts recalculés en temps réel.
 * Montée de niveau (Niveaux 1 à 10) : un assistant dédié en 5 étapes gère les paliers, l'achat d'améliorations, le multiclassage et l'échange de cartes de domaine selon les règles officielles.
 * Sauvegarde locale : exportez et importez vos personnages au format JSON à tout moment.
Dés de Dualité intégrés
 * Accessible directement depuis la fiche sans quitter la page.
 * Lancez vos deux d12 (Espoir et Peur) avec gestion de l'avantage/désavantage, dépense automatique d'Espoir pour vos Expériences, détection des succès critiques et historique des jets.
Compendium & Outils du MJ
 * Tout le SRD à portée de main : 210 cartes de domaine, 242 objets (butins et consommables), 13 classes, 26 sous-classes, 24 ascendances, 15 communautés, 6 transformations, plus de 390 armes et armures.
 * Bestiaire & Environnements : 264 adversaires complets et 47 environnements prêts à l'emploi, filtrables par palier et par type.
 * Écran du MJ : réserve de Peur, gestion des comptes à rebours et aide-mémoire des règles (conditions, repos, création d'affrontements).
Langues et traduction
L'interface et le cœur des règles utilisent la terminologie française officielle de Black Book Éditions.
 * Contenu traduit : règles de base, créateur de personnage, 186 cartes de domaine, 242 objets d'inventaire.
 * Contenu Hope & Fear : les ajouts de l'extension (domaine Effroi, 4 classes, ascendances/communautés) disposent d'une traduction amateure signalée par un badge « H&F ».
 * Bestiaire (en cours) : les statblocks des 264 adversaires sont complets, mais une partie des descriptions et capacités est encore en anglais en attendant la fin de la traduction.
Installation & Lancement
L'application est une PWA (Progressive Web App) purement statique.
> Important : Ne lancez pas index.html directement (en file://), cela bloquerait le mode hors-ligne. Passez toujours par un serveur local ou un hébergement web.
> 
1. Tester en local
Décompressez l'archive et lancez un serveur HTTP simple dans le dossier :
python3 -m http.server 8080

Rendez-vous ensuite sur http://localhost:8080.
2. Installer sur mobile ou ordinateur
Une fois l'application hébergée (GitHub Pages, Netlify, Vercel...) et ouverte dans votre navigateur :
 * iOS (Safari) : appuyez sur Partager → Sur l'écran d'accueil.
 * Android (Chrome) : ouvrez le menu ⋮ → Installer l'application.
 * PC / Mac (Chrome, Edge) : cliquez sur l'icône d'installation à droite de la barre d'adresse.
Vie privée
Aucune donnée ne quitte votre appareil. Vos personnages, vos jets de dés et vos réglages MJ sont enregistrés uniquement dans le stockage local (localStorage) de votre navigateur.
Notes techniques & Contribution (v25)
Les données du jeu sont extraites directement du SRD 2.0 officiel via les scripts Python situés dans scripts/ (en stricte conformité avec la licence DPCGL 2.0 : aucun contenu playtest ni illustration propriétaire).
Pour mettre à jour ou poursuivre la traduction des données SRD :
python3 scripts/translate-srd.py   # Reprend la traduction via le cache
python3 scripts/build-app-data.py  # Recompile les données pour l'application

Licences & Crédits
 * Règles et contenu : Daggerheart SRD 2.0 © Critical Role, LLC — sous licence Darrington Press Community Gaming License (DPCGL).
 * Terminologie française : © Black Book Éditions (Livre de règles Daggerheart, 2026).
 * Architecture & Design : inspirés du module Foundryborne Daggerheart (© 2025 WBHarry, licence MIT).
Application non officielle développée par des fans, sans affiliation avec Critical Role, Darrington Press ou Black Book Éditions.
Ce qui a changé :
 * Lisibilité : J'ai découpé les gros blocs en listes courtes orientées "bénéfices pour le joueur".
 * Cohérence : J'ai fusionné les infos de la v25 dans le corps du texte (ex: les 6 transformations, le bestiaire, la source SRD 2.0) et supprimé la contradiction sur le module Foundry (tu disais d'abord que les objets venaient de Foundry, puis en bas que Foundry n'était plus utilisé).
 * Hiérarchie : Les détails techniques sur les scripts Python sont relégués à la fin pour ne pas effrayer les joueurs qui veulent juste installer l'appli.
