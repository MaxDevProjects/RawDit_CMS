# Clower-edit

Base du projet avec une arborescence claire pour séparer moteur, données et sorties statiques.

```
core/            Scripts NodeJS (lecture/écriture JSON, rendu Nunjucks, build Tailwind)
data/            Sources JSON (sites, pages, blocs, thèmes, utilisateurs, etc.)
templates/
  site/          Layouts et blocs Nunjucks pour le site public
  admin/         Layouts et pages Nunjucks pour l'interface admin
admin_public/    Assets HTML/CSS/JS générés pour l'admin
public/          Site statique généré
```

> ℹ️ Le dossier `old/` est conservé uniquement pour référence et ne fait pas partie de la nouvelle structure.

## Scripts NPM

- `npm run dev` : lance le serveur Express (http://localhost:8080) qui sert `public/` sur `/` et `admin_public/` sur `/admin`. Le watcher `chokidar` reconstruit automatiquement HTML, JS et CSS dès qu'un fichier `data/**/*.json` ou `templates/**/*` change.
- `npm run build` : reconstruit entièrement les sorties `public/` et `admin_public/` (nettoyage, rendu Nunjucks, bundle JS via esbuild et Tailwind CLI v4 en mode minifié).
- `npm run rebuild-css` : exécute uniquement la phase Tailwind (utile lors de l'itération sur `core/styles/*.css` sans toucher aux templates).

Les scripts Node correspondants se trouvent dans `core/` et assurent la lecture/écriture JSON, le rendu Nunjucks et la génération Tailwind comme indiqué dans la note technique.

## Authentification

Au premier lancement (`npm run build` ou `npm run dev`), le fichier `data/users.json` est créé s'il n'existe pas encore avec un compte par défaut `admin` / `admin`. Le mot de passe est immédiatement hashé via `bcryptjs` et n'est jamais stocké en clair.

L'atelier admin nécessite désormais une session : toute requête vers `/admin_public/*.html` (hors `login.html`) et `/admin` vérifie la présence du cookie `admin_session`. Sans session valide, l'utilisateur est redirigé vers `/admin/login.html` (ou `/admin_public/login.html`). La page de connexion appelle l'API `POST /api/login`, crée un cookie HTTP-only et redirige vers l'espace protégé. Un bouton « Déconnexion » est présent dans l'admin pour nettoyer la session (`POST /api/logout`).
