# Repository Guidelines

## Project Structure & Module Organization
- `core/`: Node build/dev scripts, render pipeline, auth bootstrap (`core/dev.js`, `core/build.js`).
- `templates/`: Nunjucks sources for the admin UI and site pages; `templates/admin/workspace` holds workspace screens.
- `admin_public/`: Built admin assets (HTML/JS/CSS) generated from templates and scripts.
- `public/`: Built site assets served to end users; `/public/sites/<slug>/media` hosts uploaded files.
- `data/`: Content and configuration (sites, media); treat as source of truth for builds.
- `tests/`: Place automated checks here; add new suites alongside features.

## Build, Test, and Development Commands
- `npm run dev`: Start local dev server with live rebuilds (`core/dev.js`).
- `npm run build`: Full production build (cleans public/admin, renders templates, bundles JS/CSS).
- `npm run rebuild-css`: Rebuild Tailwind CSS only.
- `npm run user:add` / `npm run user:list`: Manage admin users in the local auth store.

## Coding Style & Naming Conventions
- JavaScript (ES modules) with 2-space indentation and semicolons; prefer concise, well-named helpers.
- Keep UI strings in French to match existing copy.
- Templates: Nunjucks with lowercase-kebab filenames; use data attributes (`data-...`) for JS hooks.
- CSS: Tailwind utility-first; avoid ad-hoc inline styles outside utilities.

## Testing Guidelines
- Add feature-level tests under `tests/`; mirror folder structure of the code under test.
- Name files `<feature>.test.js` and keep assertions focused on observable behavior.
- Run tests locally before pushing (add an npm script if you introduce a runner).

## Commit & Pull Request Guidelines
- Commits: use clear, imperative messages (e.g., “Add media upload inline flow”, “Fix delete action state”).
- PRs: include a short summary, linked issue (if any), steps to test, and screenshots/GIFs for UI changes.
- Keep diffs scoped; split unrelated changes into separate commits/PRs.

## Security & Configuration Tips
- Never check in credentials; use `.env` for secrets if needed (keep it untracked).
- Media and data under `data/` drive builds—validate inputs and sanitize file names before upload endpoints.
