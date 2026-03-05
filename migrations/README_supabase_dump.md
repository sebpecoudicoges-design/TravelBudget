# Supabase — Dump complet et dump du schéma (objectif "rebuild local")

## Pourquoi Docker est requis
La commande `supabase db dump` s’appuie sur une image Docker (Postgres + outils) pour reconstruire/inspecter le schéma et exporter proprement la base.
Sans Docker Desktop, l’erreur classique est du type *failed to inspect docker image*.

## Pré-requis (Windows)
1. Installer **Docker Desktop** (WSL2 activé).
2. Lancer Docker Desktop (il doit tourner en arrière-plan).
3. Installer/mettre à jour le CLI Supabase :
   - `npm i -g supabase` (ou via ton gestionnaire habituel)
4. Se connecter et lier le projet :
   - `supabase login`
   - `supabase link --project-ref obznbrzarhvmlbprcfie`

## Exports recommandés
Depuis le dossier du projet (ou n’importe où, une fois `supabase link` fait) :

### Dump complet (schema + data)
```bash
supabase db dump > supabase_full.sql
```

### Dump schema uniquement (public)
```bash
supabase db dump --schema public > supabase_schema_public.sql
```

## Bonnes pratiques
- Versionner les dumps **hors ZIP** (dans une discussion, ou dans un dossier `migrations/` séparé si tu le souhaites).
- Garder `supabase_schema_public.sql` à jour avant toute refacto RLS/RPC importante.
- Si tu ajoutes des fonctions/RPC, pense à vérifier :
  - `SECURITY DEFINER` + `search_path = public`
  - GRANT EXECUTE sur `authenticated` (et `service_role` si besoin)

## Checklist rapide
- [ ] Docker Desktop lancé
- [ ] `supabase login` OK
- [ ] `supabase link ...` OK
- [ ] `supabase db dump` OK
