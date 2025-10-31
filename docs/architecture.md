# Clower Edit – Architecture V1+

## Objectifs
- CMS local multi-site pour générer et déployer des sites statiques sobres.
- Backend Express modulaire, stockage JSON plat par site.
- Interface admin Alpine.js + Tailwind CSS v4 (presets UI seulement).
- Preview dynamique (iframe/modal/onglet) synchronisée avec le contenu.
- Automatisation du déploiement (FTP/SFTP) et génération statique.
- Respect accessibilité (ARIA, reduced motion) et sobriété (purge CSS, cache long).

## Arborescence cible
```
.
├─ server.js
├─ package.json
├─ tailwind.config.js
├─ docs/
│   └─ architecture.md
├─ backend/
│   ├─ lib/
│   │   ├─ auth.js
│   │   ├─ sites.js
│   │   ├─ storage.js
│   │   ├─ media.js
│   │   ├─ preview.js
│   │   ├─ seo.js
│   │   └─ deploy.js
│   ├─ middlewares/
│   │   ├─ auth.js
│   │   ├─ error.js
│   │   └─ security.js
│   ├─ routes/
│   │   ├─ admin.js
│   │   ├─ pages.js
│   │   ├─ preview.js
│   │   ├─ seo.js
│   │   ├─ media.js
│   │   └─ deploy.js
│   ├─ services/
│   │   ├─ tailwind.js
│   │   └─ watcher.js
│   ├─ sites/
│   │   └─ default/
│   │       ├─ config.json
│   │       ├─ pages/
│   │       ├─ seo/
│   │       ├─ media/
│   │       └─ theme.json
│   └─ scripts/
│       ├─ generate.js
│       └─ deploy.js
├─ admin/
│   ├─ index.html
│   ├─ main.js
│   ├─ stores/
│   ├─ components/
│   ├─ styles.css
│   └─ presets/
└─ public/
    ├─ assets/
    └─ generated/
```

## Flux principal
1. **Authentification** : `/api/login` délivre un JWT signé. Middleware `auth` vérifie le token sur toutes les routes protégées.
2. **Sélection du site** : le header `X-Site` ou le paramètre `site` choisit le dossier cible dans `backend/sites`.
3. **CRUD JSON** :
   - `pages`: fichiers JSON dans `pages/`.
   - `seo`: fichiers JSON dans `seo/`.
   - `theme` & `settings`: JSON (déploiement, presets UI).
   - Stockage via module `storage.js` (lecture/écriture atomique).
4. **Médias** : upload vers `media/` du site, compression `sharp`, métadonnées alt requises.
5. **Preview** : service `preview.js` met en cache la dernière génération statique et sert une iframe `/admin/preview`. Rafraîchissement via SSE/WebSocket léger (EventSource).
6. **Tailwind** : les presets (composants) se basent sur design tokens; watcher déclenche rebuild CSS (Tailwind v4) et notifie la preview.
7. **Déploiement** : script `backend/scripts/deploy.js` accepte `--site`, se base sur config FTP/SFTP et envoie `/public/generated/{site}`.

## Sécurité & performance
- Headers de sécurité (Helmet sans dépendance ? → configuration manuelle Express).
- Validation stricte des payloads (schémas JSON artisanaux).
- Cache long pour assets générés, compression gzip/brotli via Express.
- Limitation upload et taille JSON.
- Pas de code inline dynamique non échappé.

## Accessibilité & UX
- Composants admin avec ARIA, focus management, support clavier.
- Respect des préférences `prefers-reduced-motion`.
- Options preview (iframe intégrée, modal, nouvel onglet) conservées en localStorage.

## Tâches principales
1. Mettre en place l’infrastructure Express + JWT + multi-site.
2. Implémenter CRUD pages/SEO/thème/médias + génération statique.
3. Construire l’interface admin (Alpine.js, Tailwind presets) couvrant toutes les sections.
4. Ajouter preview dynamique + rebuild Tailwind.
5. Déploiement FTP/SFTP + automatisations.
6. Finaliser accessibilité, performance, scripts de build.
