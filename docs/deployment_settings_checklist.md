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

Admin functions should run with `verify_jwt=true` and still validate the caller role with `profiles.role = 'admin'` inside the function before using the service role key.

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

## Public Links

Before a Play Store submission or a public project-page update, run:

- `npm run links:check`

Expected result:

- `public/projet.html` links resolve locally or over HTTPS.
- `public/privacy.html` anchors and support links remain valid.
- The current APK link responds before it is referenced from the public page.

## Android App Bundle

Use the debug APK for fast device tests, then the AAB workflow for Play Store readiness.

- Local unsigned/sanity bundle: `npm run android:bundle-check`
- Signed Play Store bundle: `npm run android:bundle-release`

The signed command requires these local environment variables. Keep the keystore and passwords out of Git.

- `TB_ANDROID_KEYSTORE_PATH`
- `TB_ANDROID_KEYSTORE_PASSWORD`
- `TB_ANDROID_KEY_ALIAS`
- `TB_ANDROID_KEY_PASSWORD`

Expected result:

- `public/downloads/travelbudget-<version>-<stamp>-release.aab` exists.
- The script prints file size and SHA-256.
- Signed builds run `jarsigner -verify -certs`.
- `versionName` and `versionCode` still derive from `package.json`.
