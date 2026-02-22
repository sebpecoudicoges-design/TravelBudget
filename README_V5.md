# TravelBudget V5 (Vite refactor)

This is a **structural refactor** of the V4.2 stabilized build:

- Vite dev server + build pipeline
- Single entrypoint: `src/main.js`
- Legacy scripts preserved (loaded sequentially) to avoid behavior changes
- Legacy JS moved to `public/legacy/js/` (no more fragile `<script>` ordering in `index.html`)

## Requirements

- Node.js **20+** recommended (modern tooling compatibility).

## Install

```bash
npm install
```

## Run (dev)

```bash
npm run dev
```

Then open the URL shown by Vite (default: `http://localhost:8000`).

## Build (static)

```bash
npm run build
npm run preview
```

The production build is generated into `dist/`.

## Notes

- Supabase and ApexCharts are still loaded via CDN (same as V4.x) to preserve existing globals.
- Next step (post-V5) is to convert legacy modules incrementally into real ES modules (`src/core`, `src/ui`, `src/infra`).

## Admin / Membres (nouveau)

### Objectif
Ajouter un onglet **Membres** visible uniquement pour les comptes `profiles.role = 'admin'`.

### Prérequis SQL
1. Exécuter `sql/patch_members_admin.sql` dans Supabase.
2. Mettre ton propre user en admin (voir fin du fichier SQL).

### Edge Functions à déployer
Dans `supabase/functions/` :
- `admin-invite` (envoi email d'invitation)
- `admin-list-users` (liste des comptes)
- `admin-generate-invite-link` (génère un lien d'invitation)
- `admin-generate-recovery-link` (génère un lien reset mot de passe)

Configurer les variables d'environnement des fonctions :
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SITE_URL` (optionnel, ex: `http://localhost:8000`)
