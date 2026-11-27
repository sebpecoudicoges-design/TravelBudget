# F12 — Périmètre de la Content Security Policy

Inventaire statique de la branche d’audit, pas de mesure du site en ligne ni de collecte de signalements.

## Portée de la configuration versionnée

| Route ou famille | Règle versionnée dans `netlify.toml` |
| --- | --- |
| `/*` | CSP générale **Report-Only**, donc ne bloque pas le chargement. Autres en-têtes configurés : nosniff, SAMEORIGIN, referrer strict-origine en accès cross-origin, HSTS et Permissions-Policy. |
| `/connect-chatgpt.html` | CSP **bloquante**, scripts et styles de même origine, connexions de même origine et vers l’origine Supabase du projet, pas d’ancêtre, de balise base ni de soumission de formulaire. Cache désactivé ; politique de référent dédiée. |
| `/legacy/js/*`, `/legacy/css/*`, `/assets/*` | Règles de cache dédiées ; pas de CSP bloquante supplémentaire déclarée. |
| `/mcp`, `/mcp-auth/*` et quatre métadonnées `/.well-known/*` énumérées | Réécritures forcées vers une fonction Supabase. Ne pas déduire les en-têtes de ces réponses proxy du bloc déclaré pour le HTML statique. |

La version auditée ne livre pas de fichier `_headers` supplémentaire. L’inventaire n’établit pas comment les en-têtes se combinent dans les réponses Netlify effectives, ni les règles ajoutées hors dépôt. La WebView Capacitor qui charge le bundle local n’hérite pas de ces en-têtes HTTP Netlify.

## Compatibilité à établir avant de passer au blocage

| Parcours normal | Point à vérifier en prévisualisation isolée |
| --- | --- |
| Démarrage, Projet, navigation et mode hors ligne | `index.html` et `projet.html` contiennent des scripts intégrés ; l’application et la page Projet comportent aussi des styles intégrés. Vérifier le HTML construit, les ressources locales, la restauration hors ligne et les contrôles interactifs avant de resserrer les sources ou de migrer ces blocs. N’inférer ni besoin ni absence de besoin de `unsafe-eval` à partir de son seul libellé. |
| Connexion web et retour Google, intégration ChatGPT | Séparer l’appel API/Auth, la navigation vers le fournisseur et la page de retour ; une navigation de premier niveau ne se valide pas par `connect-src`. Le HTML de consentement utilise deux scripts externes locaux et une feuille locale. Ne pas élargir sa politique sous prétexte de régler un parcours de l’app principale. |
| Documents personnels et Trip | Mesurer séparément la récupération du lien signé, l’image, l’iframe PDF, les éventuelles URL blob et le repli ouvrir/télécharger. Utiliser une fixture fictive, sans jeton, signature ni URL de production dans les traces. Ne pas confondre un cadre PDF blanc sur Android avec une violation de cette politique web. |
| Médias et devises | Identifier les vraies origines et types de ressources sur la version candidate : les listes larges dans `img-src`, `media-src`, `font-src` et `script-src` ne sont pas un inventaire de trafic. Pour les taux, distinguer l’appel direct Frankfurter du flux via la fonction distante. La version auditée ne suffit pas à prouver les besoins des vidéos du site public. |

La politique générale n’indique pas de point de collecte `report-uri` ou `report-to`. Aucune visibilité centralisée n’est donc démontrée par cette configuration. Commencer par les événements du navigateur dans un environnement de prévisualisation sans données réelles. Si la collecte est envisagée plus tard, définir d’abord minimisation, rétention et traitement des URL sensibles.

## Contrat reproductible

```sh
npm run build
python3 scripts/audit-web/check-csp-staging.py --dist dist
```

Le contrôle parse le TOML et le HTML, vérifie la distinction report-only/bloquante, le contrat du consentement, l’absence d’un second fichier d’en-têtes et la présence de ses ressources locales dans le build. Il ne simule ni Netlify ni la totalité de l’application dans un navigateur. Le périmètre général ne doit pas être promu sur ce seul résultat : faire passer les parcours normaux en prévisualisation isolée, noter les dépendances observées, limiter le premier lot bloquant à un périmètre vérifié et prévoir le retour en Report-Only. Aucune règle de production modifiée.
