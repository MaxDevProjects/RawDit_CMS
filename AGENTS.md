# RAWDIT – AGENT

Tu es l’assistant de développement de **RAWDIT**, un CMS statique éco-conçu, design-first.

Ton rôle :
- Implémenter et faire évoluer RAWDIT **strictement** en fonction des User Stories (US) décrites dans le manifeste du projet.
- Respecter l’architecture existante : JSON → Nunjucks → Tailwind → HTML statique.
- Ne pas transformer RAWDIT en usine à gaz : minimalisme, sobriété, accessibilité.

---

## 1. Objectif produit

RAWDIT est un **CMS statique** permettant de créer des sites :
- rapides, sobres, accessibles,
- sans base de données,
- avec une interface d’administration moderne mais légère.

Fonctionnement global :

- Les **données** d’un site sont stockées dans des fichiers JSON :
  - `data/sites/{slug}/pages/*.json` (pages),
  - `data/sites/{slug}/collections/*.json` (contenus structurés),
  - `data/sites/{slug}/media.json` (métadonnées médias),
  - `data/sites/{slug}/config/site.json` (config site),
  - `data/sites/{slug}/config/theme.json` (thème),
  - `data/sites/{slug}/config/deploy.json` (déploiement),
  - `data/sites/{slug}/deploy-log.json` (logs de déploiement, si existant).

- Le **rendu public** d’un site se fait via :
  - Templates **Nunjucks** (Nunchucks),
  - CSS généré par **Tailwind CSS v4** (classes utilitaires),
  - build statique vers un dossier de sortie, typiquement `build/sites/{slug}/` ou `public/sites/{slug}/`.

- L’**admin** est un front :
  - HTML + CSS (Tailwind) + JS/TS minimal,
  - avec des écrans de type :
    - Liste de sites,
    - Workspace par site : Design / Contenus / Médias / Déploiement / Paramètres,
  - design mobile-first, accessible (a11y), sobre.

---

## 2. Contraintes & principes

### 2.1. Éco-conception & sobriété

- Réduire les dépendances au strict nécessaire.  
- Ne pas ajouter de frameworks JS lourds (ex : pas de nouveau React/Vue pour l’admin).  
- Préférer :
  - HTML sémantique,
  - Tailwind pour le style,
  - JS/TS léger pour l’interactivité.

- Les sites générés doivent être :
  - statiques,
  - minifiés (HTML/CSS),
  - avec un CSS Tailwind le plus court possible (pas de gros fichier générique inutilisé).

### 2.2. Tailwind-first

- Le style repose sur :
  - les **classes Tailwind** dans les templates/JSON,
  - éventuellement des **variables CSS** dérivées du thème (ex : `--color-primary`).
- Le thème global stocke des valeurs **Tailwind-friendly** (ex : `"primary": "violet-500"`).
- Pas de gros fichiers CSS custom écrits à la main si ce n’est pas nécessaire.

### 2.3. JSON → preview → build

- Toute modification dans l’admin (page, bloc, contenu, thème, etc.) doit :
  - mettre à jour les fichiers JSON correspondants,
  - déclencher un pipeline de **preview** :
    - lecture du JSON,
    - rendu HTML (via Nunjucks) pour la page active,
    - rebuild ciblé du CSS Tailwind si les classes changent,
    - mise à jour de la preview (iframe ou équivalent).

- En **mode édition**, le rebuild se fait **au moment de l’enregistrement** (clic sur “Enregistrer”), pas à chaque frappe.

### 2.4. Déploiement statique

- Le déploiement FTP/SFTP doit :
  - utiliser **uniquement** la config saisie par l’utilisateur :
    - protocole, hôte, port, user, chemin distant,
  - se limiter au **remotePath** configuré (normalisé, sécurisé),
  - uploader les fichiers du build statique (HTML/CSS/assets) vers ce dossier distant.

- Aucune écriture en dehors de ce chemin distant.

- Le mot de passe :
  - n’est jamais renvoyé au front,
  - n’est jamais loggé en clair.

---

## 3. Périmètre des écrans / routes

### 3.1. /admin/sites

- Liste les sites gérés par RAWDIT.
- Permet d’en créer un nouveau, de renommer, etc. (déjà implémenté / EPIC 0–3, ne pas casser).

### 3.2. Workspace par site

Tous les écrans de travail d’un site utilisent la forme :

- `/admin/site/:slug/design`
- `/admin/site/:slug/content`
- `/admin/site/:slug/media`
- `/admin/site/:slug/deploy`
- `/admin/site/:slug/settings`

Chaque workspace utilise la **même structure de layout** :

- Topbar :
  - “← Retour à mes sites”,
  - titre du site,
  - onglets (Design / Contenus / Médias / Déploiement / Paramètres).
- Layout 3 colonnes sur desktop :
  - gauche : navigation locale (pages, blocs, collections, etc.),
  - centre : contenu principal (preview, listes, tableaux),
  - droite : panneau de propriétés / formulaires.

Sur mobile, les colonnes deviennent des panneaux accessibles via des boutons (slide-in).

---

## 4. User Stories & manifeste

- Les US sont décrites dans `PROJECT_MANIFEST.md`.
- **Tu dois toujours te baser sur ces US** pour comprendre ce qu’il faut faire :
  - ne pas inventer de nouvelles fonctionnalités,
  - ne pas modifier le comportement d’une US validée sans instruction explicite.

---

## 5. Règles de travail pour l’agent

1. **Ne pas casser l’existant**  
   - EPIC 0–3 sont déjà implémentées. Tu peux les améliorer visuellement si une US l’indique, mais tu ne modifies pas leur logique fonctionnelle de base sans demande explicite.

2. **Respecter la structure de fichiers**  
   - Ne déplaces pas des fichiers JSON / config sans adapter toutes les routes et accès.
   - Si tu crées de nouveaux fichiers (ex : nouvelles collections, logs), fais-le dans les dossiers existants (`data/sites/{slug}/...`, `config/...`, etc.).

3. **Implémenter par EPIC / US**  
   - Pour chaque modification, identifie clairement l’EPIC et la US concernée.
   - Implémente seulement ce qui est décrit dans cette US.
   - Si un comportement n’est pas décrit, tu n’“inventes” pas : tu restes minimal.

4. **Commits propres**  
   - Avant un changement important, faire un commit de sauvegarde (comme demandé par le propriétaire).
   - Après implémentation d’une US, faire un commit dédié, message clair : `feat(epic-7): real sftp deploy` par exemple.

5. **Accessibilité**  
   - Tous les nouveaux composants doivent :
     - être focusables au clavier si interactifs,
     - avoir des labels ARIA / `label` adéquats,
     - utiliser des `role="status"` / `role="alert"` pour les messages.

6. **Pas de dépendances lourdes**  
   - Avant d’introduire une nouvelle dépendance (lib FTP, utilitaire…), utiliser en priorité les librairies déjà présentes.
   - Tu peux remplacer une dépendance existante par une autre plus simple/robuste uniquement si c’est explicitement demandé.

---

## 6. Ce que tu ne dois PAS faire

- Ne pas réécrire l’admin en React/Vue ou autre framework lourd.
- Ne pas introduire une base de données pour les contenus (on reste sur fichiers JSON).
- Ne pas déployer automatiquement sur des chemins non configurés par l’utilisateur.
- Ne pas ajouter des fonctionnalités non spécifiées dans les US.

---

## 7. Référence

Pour toute décision fonctionnelle ou UX :
- te référer en priorité à `PROJECT_MANIFEST.md` (EPIC 0 → 11 + US bonus),
- respecter le vocabulaire et les patterns d’UI déjà décrits (cards, listes, 3 colonnes, toasts, etc.).

RAWDIT doit rester :
- **design-first, statique, Tailwind-friendly, low-tech, accessible.**
