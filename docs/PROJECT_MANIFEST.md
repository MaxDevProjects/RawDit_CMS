 # RAWDIT – Manifeste du projet

Ce document regroupe les User Stories (US) qui définissent le comportement attendu de RAWDIT V1.

RAWDIT = CMS statique éco-conçu pour créer des sites :
- basés sur des fichiers JSON,
- rendus via Nunjucks + Tailwind,
- administrables via une interface HTML/JS/Tailwind,
- déployés par FTP/SFTP.

---

## EPIC 0 – Fondations de l’admin (structure de base)

> EPIC déjà implémentée et validée (squelette admin, layout global).  
> Non redéfinie ici pour éviter d’inventer des détails.

- US0.x – Initialisation du projet, layout de base, structure des dossiers, page d’admin racine, etc.

---

## EPIC 1 – Authentification (admin)

> EPIC déjà implémentée (connexion admin par défaut).  
> On sait que :
> - il existe un utilisateur `admin`,
> - un mot de passe par défaut, modifiable dans les paramètres (voir EPIC 8).

- US1.x – Se connecter à l’admin avec login/mot de passe.
- US1.x – Gestion de session minimale (accès restreint aux pages d’admin).

---

## EPIC 2 – Liste des sites & navigation

> EPIC déjà implémentée (page “Mes sites” / sélection du site).  
> Utilisée comme point d’entrée vers `/admin/site/:slug/...`.

- US2.x – Voir la liste des sites.
- US2.x – Sélectionner un site et entrer dans son workspace.

---

## EPIC 3 – Workspace & onglet “Sites”

> EPIC déjà implémentée.  
> Définit :
> - la structure 3 colonnes,
> - les onglets de workspace (Design, Contenus, Médias, Déploiement, Paramètres),
> - le comportement “Retour à mes sites”.

- US3.x – Afficher le workspace d’un site avec topbar et onglets.
- US3.x – Gérer la navigation entre “Mes sites” et un site actif.

---

## EPIC 4 – Onglet Design (pages & blocs)

### US4.1 – Lister les pages du site actif

> Voir /admin/site/:slug/design

- Voir dans la colonne gauche la liste des pages du site actif.
- Sélectionner une page la rend “active” :
  - met à jour la preview,
  - met à jour la liste des blocs.

### US4.2 – Voir les blocs d’une page

- Sous la liste des pages, afficher la liste des blocs de la page active.
- Chaque bloc connaît son type (Hero, Paragraphe, Image, Groupe, etc.) et un label.
- Cliquer sur un bloc :
  - le sélectionne,
  - affiche ses propriétés dans le panneau droit,
  - le surligne dans la preview.

### US4.3 – Ajouter / supprimer / réordonner des blocs

- Bouton “+ Ajouter un bloc” affichant une bibliothèque de blocs disponibles.
- Ajouter un bloc :
  - l’insère dans la page,
  - le sélectionne automatiquement.
- Chaque bloc :
  - peut être supprimé (avec confirmation),
  - peut être réordonné (drag & drop ou boutons ↑/↓).

### US4.4 – Preview en temps réel

- La zone centrale affiche une **preview** de la page active :
  - HTML rendu par Nunjucks,
  - styles via Tailwind.
- Après enregistrement d’un bloc/thème :
  - mise à jour du JSON,
  - rebuild ciblé (HTML + CSS si classes changent),
  - rafraîchissement de la preview.

### US4.5 – Éditer les propriétés d’un bloc

- Panneau droit :
  - onglet “Contenu” : champs adaptés au type de bloc (titre, texte, image, CTA…),
  - onglet “Apparence” : styles simples (alignement, layout, espacements, etc.).
- Bouton “Enregistrer” :
  - met à jour le JSON de page,
  - relance la preview.

### US4.6 – Bloc “Groupe” mobile-first

- Un bloc de type “Groupe” permet de définir un layout responsive simple :
  - props `colsMobile`, `colsDesktop`.
- Génère les classes Tailwind correspondantes (ex. `grid-cols-1 md:grid-cols-3`).

### US4.7 – Choisir le layout mobile d’une grille bloc par bloc

- Pour chaque bloc de type grille (`Groupe` en mode grille/cartes et `CollectionGrid`), l’éditeur peut définir un champ `mobileLayout` avec deux valeurs :
  - `stack` : comportement actuel, items empilés verticalement,
  - `horizontal-scroll` : cartes sur une ligne avec scroll horizontal natif.
- Valeur par défaut : `stack` pour préserver l’existant et pour tout nouveau bloc.
- Quand `mobileLayout = "horizontal-scroll"` :
  - Sur mobile, la grille devient `flex gap-* overflow-x-auto snap-x snap-mandatory pb-4 scroll-smooth` avec scrollbar masqué (`[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`) et un `aria-label` explicite si nécessaire.
  - Chaque carte devient `snap-center snap-always flex-shrink-0 w-64 md:w-auto` afin de créer un carrousel “swipe” fluide sans boutons ni JS lourd.
  - À partir du breakpoint desktop (md+), le layout redevient la grille classique (colonnes configurées, overflow visible).
- L’option est éditable dans le panneau droit, onglet “Apparence” du bloc concerné, section “Affichage sur mobile” avec une aide rappelant le comportement.

### US4.8 – Hiérarchie des pages (parent/enfants) et slugs imbriqués

> Objectif : permettre une architecture HTML-first cohérente (URLs et build statique en sous-dossiers).

**Critères fonctionnels :**

- Chaque page peut définir une page parente via un champ `parentId` (string ou `null`).
- La page d’accueil (`slug = "/"`) ne peut pas avoir de parent.
- Le slug d’une page peut contenir plusieurs segments (ex : `/services/seo`) et le build génère les fichiers statiques correspondants (ex : `services/seo.html`).
- Dans l’admin (Design > Propriétés de la page) :
  - un sélecteur “Page parent” permet de choisir un parent (ou “Aucune”),
  - un champ “Segment” permet de définir le dernier segment du slug,
  - l’URL finale (slug complet) est affichée et enregistrée lors de l’enregistrement.
- Le CMS empêche les incohérences minimales :
  - pas de parent = la page reste au niveau racine,
  - pas de cycles (une page ne peut pas devenir l’enfant de l’un de ses descendants),
  - pas de slug dupliqué.

**Notes :**

- V1 : pas de redirections automatiques si un slug change (le créateur gère l’impact SEO).

---

## EPIC 5 – Onglet Contenus (collections)

### US5.1 – Voir les collections du site actif

- `/admin/site/:slug/content` :
  - colonne gauche : liste des collections (`Projets`, `Articles`, `Témoignages`, etc.),
  - zone centrale : message “Choisis une collection” si aucune n’est sélectionnée.

- Les collections sont définies dans un JSON par site :
  - ex. `data/sites/{slug}/collections/index.json`.

### US5.2 – Lister & éditer les items d’une collection

- Quand une collection est sélectionnée :
  - la zone centrale liste les items (titre, slug, statut, date).
- Panneau droit :
  - formulaire d’édition de l’item (titre, slug, résumé, texte, image, statut).
- Créer / éditer / supprimer un item met à jour le JSON de collection.

### US5.3 – Lier une collection à un bloc de page

- Certains blocs (ex. “Grille de contenus”) peuvent pointer sur une collection :
  - ex. `collectionId = "projects"`, `limit = 6`.
- Le rendu Nunjucks boucle sur les items de la collection.
- L’édition de ce lien se fait dans le panneau droit du bloc.

---

## US X – Importer des pages via fichiers JSON

> US intermédiaire pour permettre l’**import data-first**.

- Permet d’importer, pour un site donné, un ou plusieurs fichiers JSON :
  - **1 fichier = 1 page**.
- Chaque JSON décrit :
  - `id`, `title`, `slug`, `templateId`, `seo`, `blocks[]` (type, content, styles).
- À l’import :
  - validation de la structure,
  - si page inexistante → création,
  - si page existante → remplacement.
- Après import :
  - les pages sont éditables dans l’admin,
  - un build/preview est relancé.

---

## EPIC 6 – Onglet Médias

### US6.1 – Lister les médias

- `/admin/site/:slug/media` :
  - zone centrale : grille de cartes média (vignette, nom, type, taille),
  - colonne gauche : filtres (Tous / Images / PDF, etc.).
- Les médias sont référencés dans `data/sites/{slug}/media.json`.

### US6.2 – Uploader un média

- Bouton “Téléverser un média” ouvre une modale drag-and-drop.
- Upload :
  - stocke le fichier sur disque,
  - ajoute une entrée dans `media.json`.
- Le nouveau média apparaît dans la grille avec un highlight.

---

## EPIC 7 – Onglet Déploiement

### US7.1 – Configurer FTP/SFTP

- `/admin/site/:slug/deploy` :
  - formulaire pour protocole (FTP/SFTP), hôte, port, login, mot de passe, chemin distant.
- La config est stockée dans `data/sites/{slug}/config/deploy.json` (ou équivalent serveur).
- Le mot de passe est **saisi une fois**, stocké côté serveur, jamais renvoyé au front.

### US7.2 – Tester la connexion

- Bouton “Tester la connexion” :
  - tente une connexion FTP/SFTP avec la config enregistrée.
- Retourne un statut succès/échec avec message lisible.

### US7.3 – Sécuriser et valider le chemin de déploiement

- Le champ “Chemin distant” :
  - est normalisé (trim, `//`, `.`/`..` contrôlés),
  - est vérifié : si dangereux/invalides → déploiement refusé avec erreur claire.
- Toutes les opérations d’écriture côté FTP/SFTP se font **uniquement** à partir de ce chemin distant.
- Aucune écriture en dehors de ce chemin.

### US7.4 – Déploiement réel des fichiers statiques

- Bouton “Déployer maintenant” :
  1. lance un **build complet** du site :
     - lecture des JSON,
     - rendu HTML (Nunjucks),
     - CSS Tailwind minifié,
     - copie des assets.
  2. établit une vraie connexion FTP/SFTP avec la config existante,
  3. crée le dossier distant (`remotePath`) si besoin,
  4. envoie tous les fichiers du build dans ce dossier.

- Un log de déploiement (succès/échec, nb de fichiers, message) est :
  - stocké côté serveur,
  - partiellement affiché dans l’UI.

---

## EPIC 8 – Onglet Paramètres (compte + site + thème)

### US8.1 – Modifier le mot de passe admin

- Formulaire :
  - mot de passe actuel,
  - nouveau mot de passe,
  - confirmation.
- Vérification côté serveur, hash, mise à jour.

### US8.2 – Paramètres généraux du site

- Formulaire par site :
  - nom du site,
  - langue principale,
  - tagline.
- Stockage dans `config/site.json`.

### US8.3 – Thème global (couleurs, typo, rayons)

- Formulaire pour :
  - couleurs : primary, secondary, accent, background, text,
  - typographies : titres, texte,
  - radius : arrondis par défaut.
- Stockage dans `config/theme.json`.
- Bouton “Appliquer le thème” :
  - met à jour les tokens de thème,
  - relance un build CSS Tailwind.

### US8.4 – Sélecteurs de couleurs Tailwind-native

- Les champs de couleur du thème sont des `<select>` et non plus des color pickers libres.
- Les options sont basées sur la palette Tailwind :
  - hues : `slate, gray, zinc, neutral, stone, red, orange, ... , rose`
  - shades : `100–900`.
- Chaque couleur est stockée comme token `"hue-shade"` (ex : `"violet-500"`).
- Ces valeurs servent à générer le thème Tailwind et/ou des variables CSS.

---

## EPIC 9 – SEO par page

### US9.1 – Métadonnées SEO par page

- Pour chaque page (`page.json`), on peut définir :
  - `seo.title`,
  - `seo.description`.
- Si absents, fallback sur le SEO global du site.
- À la génération HTML :
  - `<title>` = titre SEO,
  - `<meta name="description">` = description SEO.

---

### Bonus SEO

#### US9.B1 – Gestion indexation & robots.txt

> En tant que créateur, je peux décider quelles pages doivent être indexées ou non, et le CMS génère un fichier robots.txt cohérent au déploiement.

**Critères fonctionnels :**

- Dans Paramètres > SEO global, ajouter une option :
  - checkbox : "Indexer toutes les pages par défaut".
- Dans le panneau SEO de chaque page (EPIC 9), ajouter une case à cocher "Indexer cette page".
- Logique :
  - Par défaut, une nouvelle page hérite du réglage global.
  - Si une page a une préférence explicite (indexer / ne pas indexer), cette préférence prime sur le réglage global.
- Lors du build + déploiement :
  - Générer un fichier `robots.txt` dans le dossier public.
  - Contenu minimum :
    - ligne `User-agent: *`
    - lignes `Disallow: /slug-de-la-page` pour chaque page marquée comme non indexable.
  - Pour les pages non indexées, ajouter aussi une meta : `<meta name="robots" content="noindex">` dans le head de la page.

**Détails UI :**

- Paramètres > SEO global :
  - section "Indexation" avec la checkbox "Indexer toutes les pages par défaut".
  - texte d'aide : "Les nouvelles pages seront indexées automatiquement. Tu peux exclure une page individuellement dans son onglet SEO."
- SEO par page :
  - sous Titre SEO / Meta description, checkbox "Indexer cette page".
  - texte d'aide : "Si décoché, la page sera exclue de l'indexation (robots.txt + meta robots)."

**Stockage :**

- Config site : `seo.indexAllPagesByDefault` (boolean, défaut `true`).
- Page JSON : `seo.indexed` (true/false/null) – null = héritage du réglage global.

---

#### US9.B2 – Analytics & Scripts tiers

> En tant que créateur, je peux ajouter des scripts d'analytics (GA, Matomo, etc.) sans toucher au code, pour suivre les visites de mon site.

**Critères fonctionnels :**

- Dans Paramètres (ou Paramètres > SEO), ajouter une section "Analytics & scripts".
- Deux zones de code :
  - "Code à insérer dans `<head>`"
  - "Code à insérer avant `</body>`"
- Ces snippets sont stockés dans la config du site (JSON).
- Lors du build des pages :
  - si un code head est renseigné → injecter tel quel dans la balise `<head>` de toutes les pages du site.
  - si un code body_end est renseigné → injecter tel quel juste avant la fermeture `</body>` de toutes les pages.
- Par défaut (champs vides) : aucun script n'est injecté.

**Détails UI :**

- Paramètres > Analytics & scripts :
  - Titre "Analytics & scripts".
  - Texte d'intro : "Ajoute ici les scripts fournis par ton outil d'analytics (Google Analytics, Matomo, etc.). Ils seront injectés dans les pages générées."
  - textarea monospace pour "Code à insérer dans `<head>`".
  - textarea monospace pour "Code à insérer avant `</body>`".
  - bouton "Enregistrer les scripts".
  - petit texte d'avertissement "Astuce sobriété : n'ajoute que les scripts réellement nécessaires. Ils sont chargés sur toutes les pages du site."

**Stockage :**

- Config site : `analytics.headCode` (string, défaut vide).
- Config site : `analytics.bodyEndCode` (string, défaut vide).

---

## EPIC 10 – Accessibilité de l’admin

### US10.1 – Navigation au clavier

- Tous les éléments interactifs sont focusables,
- L’ordre de tabulation est logique (header → tabs → gauche → centre → droite…),
- Style focus visible (outline/ring).

### US10.2 – Landmarks & ARIA

- usage approprié de `<header>`, `<nav>`, `<main>`, `<aside>`, `<footer>`,
- `aria-label` sur les asides (“Navigation des pages”, “Panneau de propriétés”…),
- messages système dans des éléments `role="status"` ou `role="alert"`.

### US10.3 – Accessibilité globale du site (landmarks + skip links)

- Les pages publiques générées utilisent systématiquement les landmarks HTML5 (`<header>`, `<nav>`, `<main>`, `<footer>`, `<aside>`).
- La navigation principale est labellisée (`aria-label` ou titre explicite) et expose `aria-current="page"` sur l’entrée active.
- Un lien “Aller au contenu principal” est injecté en tout début de `<body>` et cible le `<main>`.
- Les images décoratives sont marquées avec `alt=""` ou `role="presentation"`, les images informatives ont un `alt` obligatoire.
- Les menus et liens critiques sont pensés clavier-first : tabulation logique et focus visible.

### US10.4 – Accessibilité par page (SEO + navigation + blocs)

- Dans Design > SEO d’une page, une section “Accessibilité” permet de régler :
  - l’inclusion / exclusion de la page dans la navigation principale,
  - un label optionnel pour la région `<main>` (appliqué en `aria-label` si saisi).
- Chaque bloc image dispose côté admin d’un champ “Texte alternatif (alt)” obligatoire et d’un champ “Légende” optionnel.
- L’UI signale clairement les images sans texte alternatif (badge d’avertissement ou similaire).

### US10.5 – Stylage du focus et navigation clavier

- Tous les éléments interactifs exposent un focus visible (outline, ring Tailwind) cohérent sur l’admin et le site public.
- L’ordre de tabulation reste logique et les contrôles personnalisés (modales, overlays) piègent le focus.
- Les modales se ferment avec `Escape` et restituent le focus à l’élément déclencheur.

### US10.6 – Paramètres d’accessibilité globaux (site)

- Paramètres > Accessibilité expose des préférences par site :
  - “Activer les animations non essentielles” (booléen branché sur EPIC 12),
  - “Contraste élevé” (champ prêt mais optionnel pour V1),
  - rappel sur l’usage de `prefers-reduced-motion`.
- Le JSON de config du site stocke ces préférences (`accessibility.animationsEnabled`, `accessibility.highContrast`…).

### US10.7 – Audit d’accessibilité de base au build

- Lors d’un `build`, un rapport texte liste les problèmes détectés (sans casser le build) :
  - pages avec > 1 `<h1>`,
  - images sans `alt` (hors décoratives déclarées),
  - liens ou boutons sans libellé ni `aria-label`.
- Le rapport mentionne le slug du site, le chemin du fichier et un court message.
- Le rapport est affiché en console et écrit dans `build/a11y-report.txt` ou équivalent.

---

## EPIC 11 – Clower.studio comme preuve V1

### US11.1 – Construire clower.studio avec RAWDIT

- Le site clower.studio est intégralement construit via l’admin RAWDIT :
  - pages : Accueil, Services, Portfolio, À propos, Contact, pages projet…
- Il est généré dans le dossier public/build standard.
- Il est déployé via l’onglet Déploiement.
- Cette US sert de **critère de validation globale** de la V1.

---

## EPIC B – Blocs formulaires & intégrations externes

### US B.1 – Bloc “Formulaire de contact”

- Nouveau type de bloc `form` :
  - `fields[]` (nom, email, message, …),
  - `integration` (serviceName, actionUrl, method, hiddenFields[]),
  - `submit` (label, styles),
  - `styles` (bg, padding, radius, etc. via Tailwind).

- Rendu :
  - `<form>` HTML statique (action = `actionUrl`, method = POST par défaut),
  - inputs + labels accessibles,
  - bouton `type="submit"`.
- Le traitement est délégué à un **service externe** (SwitchContact, autre).

### US B.2 – Bloc “Newsletter / embed”

- Nouveau type de bloc `newsletterEmbed` :
  - `integration.serviceName`,
  - `integration.embedCode` (code HTML fourni par un service, ex. iframe Brevo).
  - `styles` (bg, padding, radius, etc.).

- Rendu :
  - `<section>` stylé Tailwind,
  - injection de `embedCode` tel quel (non échappé).

---

Fin du manifeste pour la V1 de RAWDIT.  
Toute nouvelle fonctionnalité devra être ajoutée ici sous forme d’US avant d’être développée.
