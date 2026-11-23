# Journal des modifications

Toutes les modifications notables de **Daggerborne** sont documentées dans ce fichier.

Le format s'inspire de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).
La version de référence du projet est celle de `package.json` (`0.6.1-beta`).

## [0.6.1-beta] — 23 novembre 2026

### Corrigé — audit des données et mode EN

- Nettoyage des balises Foundry restantes dans le bestiaire et les environnements FR : 279 tokens, dont 207 `@Lookup` non signalés.
- Mode EN : descriptions d’objets, Fondation remplacée sans doublon au changement de langue, libellé `Fondation`, transformations et équipement de départ.
- Compagnon : expériences proposées dans le lanceur de Dés de Dualité.
- Montée de niveau : plafond correct pour les cartes de domaine multiclassées.
- Compendium : échappement de `item.sub`.
- Version de l’application : `v.0.6.1-beta` ; `DATA_VER` v36, cache `daggerborne-v63`.
- Vérifications : lint OK, **51/51 tests**.

## [0.6.0-beta] — 23 novembre 2026

### Ajouté — traductions FR complètes (bestiaire, environnements, cartes)

- Traduction française des **264 adversaires** et des **47 environnements** : 906 capacités d’adversaires et 195 capacités d’environnement, descriptions, motivations, noms d’attaques, expériences et listes d’adversaires potentiels.
- Noms français des adversaires dans le compendium et l’écran du MJ ; les fiches conservent le nom anglais en sous-titre.
- Terminologie alignée sur l’application : portées Très proche/Proche/Éloignée/Très éloignée et « marquer » un Stress/PV.
- Audit des **210 cartes de domaine** : descriptions réalignées sur le DRS et 8 noms décalés corrigés (Healing Hands, Final Words, Reckless, Dark Whispers, Mass Disguise, Scramble, Versatile Fighter, Natural Familiar).
- Listes d’adversaires des **47 environnements** entièrement francisées ; vocabulaire harmonisé dans toutes les données (marquer, portées, aptitudes, repos long).
- Libellés FR de l’interface harmonisés : « Aptitude » remplace « Feature » dans les fiches d’arme, d’armure, d’Espoir et de sous-classe.
- Source des traductions : module communautaire **Daggerheart DRS - Français (non officiel)** de Sasmira, AGPL-3.0 — <https://gitlab.com/sasmira/daggerheart-fr-foundryborne>.
- `DATA_VER` v35, cache `daggerborne-v61`.
- Version de l’application affichée sous le titre principal : `v.0.6.0-beta`.
- Thèmes de dés versionnés (`nebula-gold-v2`, `hope-v2`, `fear-v2`) : les anciens caches PWA ne peuvent plus resservir les textures pixelisées ou teintées par simple couleur.
- Vérifications : `npm run lint` OK ; `npm test` **48/48**.

### Corrigé — audit pré-publication

- Conservation des valeurs personnalisées des armes et armures SRD lors des re-rendus (nom, score, seuils, dé, trait, portée, type).
- Normalisation des personnages importés : types numériques, tableaux et champs imbriqués invalides ; compatibilité des anciens PV/Stress sans `active`/`unlocked`.
- Repos long : la Peur du MJ utilise le nombre de PJ de l’affrontement, plus le nombre de fiches enregistrées.
- Sécurité : échappement des messages d’erreur et des libellés de la bannière de Dualité ; stockage local indisponible géré sans bloquer l’application.
- PWA : toutes les icônes du manifeste sont précachées ; cache `daggerborne-v61`.
- Documentation : compteurs réels (246 objets, 400 armes, 85 armures, 210 cartes), suppression des références aux scripts Python absents et ajout d’un `.gitignore`.

## [Non publié] — 22 novembre 2026

### Corrigé — PWA, outillage et CI

- Précache atomique : si une ressource de `CORE` manque, l'installation est annulée, le cache partiel supprimé et les URL fautives listées (auparavant l'échec était ignoré, laissant une PWA « installée » mais cassée hors-ligne).
- Navigations servies en **réseau d'abord** avec repli sur le cache : un déploiement apparaît désormais au rechargement au lieu d'attendre un second chargement.
- `server.js` : le repli SPA ne répond `index.html` qu'aux requêtes HTML ; les URL inconnues non-HTML renvoient 404.
- `npm test` ajouté ; `npm run lint` vérifie la syntaxe de **tous** les modules (`scripts/lint.mjs`) et plus seulement de `server.js` ; `npm run verify` et `npm run build` enchaînent lint + tests.
- CI APK : étape `npm run verify` avant le packaging Android.
- Garde-fous de publication (`tests/pwa.test.js`) : `VERSION` de `sw.js` = `?v=` d'`index.html`, et tout module local importé doit être précaché.
- Cache `daggerborne-v54`.

### Corrigé — mécaniques SRD 2.0

- Malus passifs d'équipement appliqués sur la fiche : Lourde (−1 Évasion), Très lourde (−2 Évasion, −1 Agilité), Encombrante (−1 Finesse), Massive (−1 Évasion), répercutés sur l'Évasion et les jets de traits.
- Forme bestiale : le bonus d'Évasion est réellement appliqué, plus seulement affiché.
- PV et Stress plafonnés à 12 emplacements (au lieu de 14).
- Repos : le MJ gagne 1d4 Peur (court) ou 1d4 + nombre de PJ (long) ; un quatrième repos court consécutif est bloqué jusqu'au repos long.
- « Tout risquer » : répartition libre du dé d'Espoir entre PV et Stress ; « Éviter la mort » applique l'état Inconscient.
- Multiclassage : accorde les capacités de classe de la classe secondaire au lieu de son aptitude d'Espoir.
- Affrontement : les Sbires coûtent 1 point par groupe de la taille du groupe de PJ, plus 1 point par instance.
- Équipement : palier limité au niveau du personnage et armes magiques réservées aux traits d'Incantation dans les sélecteurs de la fiche.
- Création : 1 poignée d'or de départ (au lieu de 2) ; textes de potions alignés sur « Effacez 1d4 PV/Stress ».
- Interface et données : « Valeur d'armure » partout (au lieu de « Score d'armure »).
- Cache `daggerborne-v53`, version des données `v32`.

### Corrigé — équipement et objets divers (FR)

- Reliques : *Attune* rendue à l'Instinct (« Relique d'harmonie »), *Stride* en « Relique de grande foulée », *Augur's* en « Relique d'augure » avec son effet réel (aptitude d'Espoir sans dépenser d'Espoir), *Communion* en « Relique de communion ».
- Doublons levés : variantes *Offhand Brass Knuckles* (« de main secondaire ») et *Lance* de cavalerie.
- Accords corrigés dans 46 noms d'armes et 14 noms d'armures (« Grande épée améliorée », « Cotte de mailles perfectionnée », « Robes d'archimage améliorées »…).
- Terminologie unifiée : Valeur d'armure, portées Très proche/Proche/Éloignée/Très éloignée, repos long/court, temps mort, Évasion, Maîtrise, MJ, effacer les PV.
- Fautes de frappe et calques corrigés dans une trentaine d'objets ; artefacts `@Template` et `[[/r …]]` retirés ; « Caltrops » traduit en « Chausse-trappes ».
- Descriptions anglaises d'armes nettoyées des fragments de statistiques injectés (Revolver, Carabine, Fusil à pompe, Lasso, Pieu en bois, Bouclier consacré).

### Ajouté

- **Mode anglais complet** : interface, titres de pages, métadonnées et contenu du SRD 2.0.
- Traduction anglaise des données restantes :
  - capacités et questions de background des 9 classes ;
  - descriptions des 10 domaines ;
  - portées des armes et des formes bestiales ;
  - catégories et impulsions des environnements ;
  - 20 descriptions de capacités d'adversaires.
- Couche de localisation de l'interface anglaise (`js/en-ui.js`, `js/i18n-dom.js`) couvrant les vues historiques : fiche, création, montée de niveau, compendium, outils du MJ, dés, réglages et notifications.
- **Crédit dice-box** dans Réglages → Crédits, avec lien vers <https://github.com/3d-dice/dice-box> (texte FR/EN).
- **Cartes de style poker** dans le compendium pour les ascendances, classes, communautés, transformations et cartes de domaine : grille de cartes au ratio 63/88, cadre doré, bandeau, médaillon d'illustration, plaque de titre, séparateur et corps papier. Ornements CSS uniquement, sans illustration officielle.

### Corrigé

- Capacités d’Espoir corrigées d’après le SRD 2.0 : Occultiste, Bagarreur, Assassin, Sorcière, Gardien, Barde, Rôdeur et Séraphin.
- Suppression des doublons entre capacités d’Espoir et aptitudes de classe dans les données FR/EN.
- Nain : « Épiderme épais » réagit désormais aux dégâts **Mineurs**, et non Majeurs.
- Harmonisation des noms d’ascendances (Célestin, Éthérien, Shatari, Côa, Braiselin, Maréen, Tellurien) entre le titre et le texte.
- Uniformisation du glossaire : « Proficiency » → Maîtrise, « Spellcast » → incantation, « long repos » → repos long, portées et temps mort.
- Corrections de fautes et de calques dans les classes, ascendances et communautés.
- Compendium : correction de l’onglet Transformations (variable `t` masquant la fonction de traduction) et des libellés d’aptitudes.
- Compendium : « Côa » remplacé par **« Ribbets »** pour l’ascendance Ribbet, dans le titre et le texte.
- Outils du MJ : harmonisation du glossaire (action de temps mort, aptitudes, portées).

### Modifié

- Le changement de langue depuis les Réglages reconstruit désormais tout le shell (navigation et titre compris), et plus seulement le contenu de la page.
- La traduction de l'interface est réversible : les éléments statiques (comme le lanceur de dés flottant) reviennent en français au retour sur cette langue.
- Les boîtes de dialogue natives (suppression de personnage, vidage de l'affrontement, fusion d'une sauvegarde) suivent la langue active.
- En mode anglais, le compendium n'affiche plus les libellés bilingues redondants ni la mention « traduction à venir ».
- Le paragraphe « À propos » des Réglages décrit correctement le contenu anglais en mode anglais.
- Les dates de l'historique des jets et du journal utilisent `en-US` en mode anglais.
- Cache du service worker mis à jour (`daggerborne-v44`) ; version des données (`DATA_VER`) portée à `v28`.

### Corrigé

- La navigation et les traits restaient en français après un passage en anglais (export statique de `T` dans `core.js`).
- Le double écouteur sur les pastilles de langue des Réglages provoquait deux rendus par clic.
- Les libellés calculés au chargement du module (onglets du compendium, étapes de création, titres de montée de niveau) ne suivaient pas les changements de langue.
- Crash dans le détail d'une transformation du compendium (variable `t` masquant la fonction de traduction).
- Les environnements anglais affichaient encore leurs descriptions françaises (`descFr` prioritaire).
- Libellé anglais erroné de l'icône de portée : « Ready » → « Range ».
- Traductions partielles dans l'écran d'affrontement du MJ (« Adversaries en jeu », « Add depuis le Bestiary »…), les aides des dés, les textes de repos et de mort de la fiche, les Réglages et les notifications d'import/export.
- Le libellé « Nom » ne corrompt plus les mots plus longs comme « Nombre » (traduction par mot exact).
- La pastille de langue conserve le nom natif « 🇫🇷 Français » au lieu de le traduire.

### Vérifications

- `node --check` sur l'ensemble des fichiers JavaScript : OK.
- `node --test tests/*.test.js` : **28/28 tests réussis**.
- Scan de `data/en/*.json` : **0** chaîne avec accent français restante.
- Contrôle ciblé de 18 chaînes d'interface : aucune traduction manquante ni reste accentué.

### Limites connues

- Les personnages enregistrent les noms affichés au moment de leur création (classe, ascendance, communauté, armes, armures). Un personnage créé en anglais conserve donc ces noms en anglais si l'application repasse en français, et inversement.
- Le contenu du bestiaire (descriptions et capacités) reste partiellement en anglais en mode français.
