# Journal des modifications

Toutes les modifications notables de **Daggerborne** sont documentées dans ce fichier.

Le format s'inspire de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).
La version de référence du projet est celle de `package.json` (`0.8.0-BETA`).

## [0.8.0-BETA] — 24 novembre 2026

### Ajouté — export PDF complet hors-ligne

- **Bouton `📄 PDF` sur la fiche de personnage (`sheet.js`, `pdfExport.js`)** : génère en un clic un dossier PDF complet prêt à imprimer ou partager, sans aucune dépendance serveur ni connexion Internet.
- **Fiches officielles Daggerheart pré-remplies (EN)** : prise en charge des **13 classes** issues des deux livrets officiels (les 9 classes de base + les 4 classes *Hope & Fear* : Assassin, Brawler, Warlock, Witch) ainsi que d'une fiche générique de secours :
  - en-tête identité (nom, pronoms, héritage/communauté, sous-classe, niveau) ;
  - Évasion effective, Valeur d'armure, 12 emplacements d'armure cochés/verrouillés, seuils de dégâts Majeur/Grave calculés, 6 traits avec bonus et coches d'amélioration, Maîtrise, PV, Stress, Espoir et Cicatrices ;
  - 5 premières Expériences, piste d'or (poignées, sacs, coffre), armes actives principale/secondaire (avec dégâts calculés selon la Maîtrise et aptitudes), armure active, inventaire (5 lignes + renvoi si surplus) et 2 emplacements d'armes de réserve.
- **Pages spéciales de classe & Guide d'évolution** : inclusion automatique des pages *Druid Beastform* (avec bandeau de forme bestiale active), *Ranger Companion* (nom, espèce, évasion, attaque, dé de dégâts, expériences et stress du compagnon) et *Brawler Martial Artist*, plus le **Guide de classe** avec les cases d'évolution des paliers 2, 3 et 4 cochées automatiquement (`tierUses`).
- **Dossier complet récapitulatif (*Character Folio*)** : pages additionnelles paginées contenant le portrait (JPEG/PNG), le résumé d'état (conditions, repos courts, multiclassage, forme bestiale, transformation), toutes les aptitudes, l'intégralité des cartes de domaine (En main et Caveau avec descriptions complètes), l'inventaire complet, les expériences supplémentaires (6+), les réponses de background, les notes et le journal de bord.
- **Compatibilité PWA, Desktop & Android APK (`core.js`, `sw.js`)** : librairie `pdf-lib` embarquée localement, normalisation texte WinAnsi (ligatures `œ`/`æ`, tirets, symboles et accents préservés), précache PWA complet (module, moteur PDF et les deux PDF officiels) et modale Android/WebView dédiée avec `Partager` et `Télécharger`.

### Modifié — workflow GitHub Actions Android (`build-apk.yml`)

- **Migration vers les actions compatibles Node.js 24 & Java 17** : mise à jour de `actions/checkout@v6`, `actions/setup-node@v6` (Node 22), `actions/setup-java@v5`, `android-actions/setup-android@v4` et `actions/upload-artifact@v6`, et copie du dossier `public/` dans l'archive `www/` de l'APK.

### Technique & vérifications

- **Version** : `v.0.8.0-BETA` ; `DATA_VER` `v37`, cache `daggerborne-v69` (`?v=69`).
- **Vérifications** : `npm run lint` OK (`22` fichiers JS), `npm test` **62/62 tests réussis**, `npm run build` OK (`Static site ready`).

## [0.7.0-beta] — 23 novembre 2026

### Ajouté — ergonomie PWA / Android & fiche de personnage

- **Pré-remplissage SRD 2.0 (`CLASSE & APTITUDES`)** : pré-remplissage automatique des aptitudes de classe et des cartes de sous-classe actives (Fondation, Spécialisation, Maîtrise) et de multiclassage lors de la création et des migrations, tout en préservant les éditions manuelles du joueur (`customClassFeature`).
- **Fiche mobile en mode portrait** : barre de sous-onglets sticky en haut de la fiche (`Combat`, `Traits & Exp.`, `Cartes`, `Sac & Or`) et empilement vertical en 1 colonne sur mobile/tablette portrait.
- **Lanceur de Dés de Dualité (`dice.js`)** : ajout d'un sélecteur de personnage (`#roll-char`) pour changer de fiche ou repasser en jet libre directement depuis l'écran Dés.
- **Modale de confirmation thémée (`confirmModal`)** : remplacement des boîtes `confirm()` natives bloquantes dans l'assistant de création, les outils MJ, la fiche et les réglages.
- **Outils MJ (Pool de Peur)** : ajout d'un repère visuel (bordure et séparateur dorés) après le 12e hexagone pour matérialiser le maximum recommandé.
- **Splash & Android** : ajout de `<meta name="theme-color" content="#0d0c14">` dans `index.html` et harmonisation des chemins de logos DPCGL sous `assets/`.

### Corrigé — mise en page, responsive & accessibilité

- **Assistant de création (`create.js`)** : barre d'actions (`Retour`, `Recommencer`, `Continuer`) positionnée en `sticky` au-dessus de la barre de navigation inférieure avec dégradé sombre et `padding-bottom` global ajusté sur le conteneur principal.
- **Boutons flottants (horloge & raccourci dés 3D)** : masqués sur l'onglet `Dés` (y compris le mini-raccourci quand replié), remontés au-dessus de la barre d'actions dans l'assistant de création, et rendus rétractables sur mobile (`< 640px`).
- **Grilles responsive & zones tactiles** : passage en 2 colonnes sous `640px` (`1fr` sous `380px`) avec masquage des descriptions longues dans les cartes de grille, rétablissement de `.dh-fl.w2` sur 2 colonnes sous `999px`, alignement de `.dh-mtabs` sous `.topbar`, et cibles tactiles `44×44 px` minimum sur les boutons `−` / `+`.
- **Écran Dés, Compendium & contrastes** : harmonisation du `padding-top` sur l'écran `Dés de Dualité`, troncature avec ellipse (`max-width: 115px`) des capsules de formule longues dans l'historique, flou d'arrière-plan (`backdrop-filter: blur(5px)`) et assombrissement de la modale de résultat, fondu/scroll horizontal des onglets du Compendium, et contraste amélioré des textes secondaires et `<select>` actifs (`#a8a29e`).

### Corrigé — règles SRD 2.0 & logique applicative

- **Sauvegarde des paliers (`tierUses`)** : ajout de `sanitizeTierUses()` dans `js/rules.js` pour préserver les compteurs imbriqués par palier (`1` à `4`) lors des chargements et imports (au lieu de les écraser).
- **Personnalisations d'armes et d'armure** : préservation des drapeaux `customName`, `customStats` et `customFeature` dans `sanitizeWeapon()` et `armorCard` lors de la sanitisation.
- **Dés de Dualité & Expériences** : application des bonus de Forme bestiale et des malus d'équipement lourd (`equipmentPenalty`) dans `dice.js` ; vérification et déduction de **1 Espoir** lors de l'utilisation d'une Expérience (avec remboursement en cas d'annulation) et sauvegarde groupée dans `rollDuality()`. Suppression du moteur de jets doublon inutilisé dans `js/core.js`.
- **Montée en niveau (`levelup.js`)** : plafonnement de l'échange de carte (étape 4) au minimum entre le niveau de l'ancienne carte et le plafond du domaine ; instantané des Expériences avant mutation pour éviter tout décalage d'index ; retour d'historique basé sur `history.state?.dhLvl`.
- **Fiche & Outils MJ** : récupération de `subcardCount` depuis `subcardTaken`, garde contre les valeurs `NaN` sur le champ d'Évasion, calcul multi-dés complet sur les attaques d'adversaires en rencontre (ex. `2d8+1d4+2`), et initialisation de `tier: 1` sur les adversaires rapides.

### Corrigé — sécurité & stockage local

- **Assainissement par liste blanche (`sanitizeCharacter`)** : rejet des clés inconnues lors d'imports JSON tout en conservant les champs SRD légitimes ; ajout des sanitizers `sanitizeAncestry()`, `sanitizeCommunity()` et `sanitizeMixedAncestry()`.
- **Limites de taille & médias** : mesure stricte en octets UTF-8 (`TextEncoder`) sur les imports JSON (personnages et sauvegardes complètes) et limite de 15 Mo appliquée avant `URL.createObjectURL` lors de l'import de portrait.
- **Politique de sécurité & échappement** : ajout de `<meta http-equiv="Content-Security-Policy">` dans `index.html`, ajout de `form-action 'self'` dans `server.js`, échappement des attributs/libellés dans `showBanner()` (`dice3d.js`), `rel="noopener noreferrer"` sur les liens externes, et gestion `try/catch` sur l'import de sauvegarde complète.
- **Stockage hybride (`IndexedDB` / `localStorage`)** : marqueur `_strippedPortraits` pour restaurer les portraits depuis IndexedDB lorsque le secours `localStorage` allégé est plus récent après saturation de quota.

### Corrigé — traductions FR/EN, données & PWA

- **Re-localisation bilingue (`sheet.js`)** : mise à jour complète au changement de langue pour les cartes de sous-classe actives, blocs de Multiclassage, ascendances mixtes (`mixedAncestry`) et anciens objets d'inventaire ; priorité aux descriptions EN (`descEn`/`desc`) dans l'onglet Inventaire en mode anglais.
- **Données & dictionnaire EN** : suppression des clés françaises superflues (`descFr`, `impulsesFr`) dans `data/en/environments.json`, ajout des traductions EN manquantes dans `js/en-ui.js` (états, éditeur d'équipement, notes) et correction du motif `/(?:LANCER|ROLL)\s+(\d+)\s+(?:dice|die)\s*!/g`.
- **Service Worker & mise à jour (`sw.js`, `app.js`)** : priorité au cache exact sur les URL versionnées (`?v=`) avant le repli `ignoreSearch` hors-ligne, suppression du `skipWaiting()` automatique pendant `install`, promotion propre des mises à jour en attente au démarrage et toast cliquable en cours de session.
- **Version** : `v.0.7.0-beta` ; `DATA_VER` `v37`, cache `daggerborne-v67` (`?v=67`).
- **Vérifications** : `npm run lint` OK (`21` fichiers JS), `npm test` **60/60 tests réussis**, `npm run build` OK (`Static site ready`).

## [0.6.2-beta] — 23 novembre 2026

### Corrigé — retours de validation 0.6.1

- Objets généraux : suppression des 9 dernières balises `@Template[...]` (3 objets, champs `desc`/`descEn`).
- Mode EN : raretés d’objets traduites (`Courant` et `Ordinaire` → `Common`, `Inhabituel` → `Uncommon`).
- Bestiaire : correction de la phrase Cryptimite et des accords de genre/pronoms issus du remplacement de `@Lookup[@name]`.
- Forme bestiale : menu « Forme de base » traduit avec le palier dynamique.
- Compagnon : les libellés par défaut traduits sont désormais persistés (`dirty`).
- Version : `v.0.6.2-beta` ; `DATA_VER` v37, cache `daggerborne-v64`.
- Vérifications : lint OK, **54/54 tests**.

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
