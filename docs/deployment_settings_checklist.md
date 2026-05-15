# Deployment Settings Checklist

## Supabase Auth

In Supabase Dashboard > Authentication > URL Configuration, keep these URLs aligned with the active Netlify site.

- Site URL: `https://stunning-dieffenbachia-2b2ed0.netlify.app`
- Redirect URLs:
  - `https://stunning-dieffenbachia-2b2ed0.netlify.app`
  - `https://stunning-dieffenbachia-2b2ed0.netlify.app/`
  - `http://localhost:5173`
  - `http://127.0.0.1:5173`

If a custom domain is added later, add both the bare domain and trailing-slash variant.

## Supabase Edge Functions

Public webhook functions:

- `whatsapp-inbox`: `verify_jwt=false`, because Twilio cannot send a Supabase JWT.

Admin functions may also run with `verify_jwt=false`, but must validate the caller Bearer token and check `profiles.role = 'admin'` inside the function before using the service role key.

## Supabase RPC Grants

Sensitive `SECURITY DEFINER` RPCs should not be executable by `anon`.

Apply:

- `db_dumps/patch_security_rpc_anon_revoke.sql`

Expected result:

- `anon`: no execute
- `authenticated`: execute
- `service_role`: execute

## Netlify

This project uses `npm` for deployment:

- Install: `npm ci`
- Build: `npm run build`
- Publish directory: `dist`

Keep only one package manager lockfile long term to avoid editor and CI ambiguity.
