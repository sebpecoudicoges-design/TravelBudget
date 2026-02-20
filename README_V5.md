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
