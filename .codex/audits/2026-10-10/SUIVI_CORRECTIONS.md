# Suivi des corrections — ordre demandé le 10 octobre 2026

Le rapport `AUDIT_PROJET.md` reste le constat de référence daté ; les corrections sont suivies ici sans réécrire les preuves initiales.

1. **Capacitor Android — corrigé et APK distribué** : Android 8.5.3, CLI 8.5.3 et Core 8.5.0 verrouillés ; APK 10.5.373 reconstruit et publié, signature et empreinte distante vérifiées. 935 tests et 4 E2E ciblés réussis. Push `532710e` et page Projet/Atlas publics vérifiés le 11 octobre 2026. Validation sur téléphone restante (aucun appareil connecté). Preuves : `docs/ANDROID_SECURITY_10_5_373.md`.
2. **Architecture et qualité — en cours** : premier lot sur la couverture syntaxique, la chaîne de validation GitHub, les arrêts sur erreur des commandes Android et la reproductibilité de l'Atlas. Voir `docs/QUALITY_PIPELINE.md`. Dépendances, mesure du démarrage et extraction progressive restantes.
3. **Base de données — à venir** : autorisations des RPC, politiques et index, traitement différé et vérifications en base.
4. **Problèmes fonctionnels importants — à venir** : synchronisation, impact budgétaire, Nutrition, Sport et Trip, avec tests de panne et relecture de persistance.

Conserver les modifications Trip déjà présentes. Le 11 octobre 2026, l'utilisateur autorise le push, la publication de la page Projet avec l'APK, la mise à jour de l'Atlas puis la poursuite de l'étape architecture et qualité.

Le 17 octobre, priorité explicite à l'incident Trip et au bouton Archiver : six transactions de remboursement déjà annulées dans Trip supprimées (300 AUD), création/annulation atomiques avec reprise idempotente, correction du sélecteur de réorganisation des wallets. Voir `docs/TRIP_WALLET_FIX_10_5_374.md`. La demande de nettoyage des anciens APK Supabase a été annulée par l'utilisateur et n'a pas été exécutée.

- 19 octobre 2026 — priorité utilisateur : projection des dépenses budgétées déjà payées corrigée dans le KPI et la courbe ; reprise de la publication des corrections Trip/wallets restées locales. Livraison regroupée 10.5.375, voir docs/PREPAID_PROJECTION_10_5_375.md.

- 21 octobre 2026 — reprise de l’étape architecture/qualité : chargement des domaines et scripts avec acquittement après succès, reprise partielle sans double exécution et reprise de l’entrée Analyse sous Chromium. Lot 10.5.376, preuves et limites dans docs/LOADER_RECOVERY_10_5_376.md. F8 reste partiellement ouvert pour les autres moteurs/imports et les dépendances internes ; F9, dépendances et extraction restent à traiter avant la phase base de données.

- 22 octobre 2026 — architecture/qualité : migration Vite 7.3.6 / Vitest 4.1.10, Node 24 homogène, dépendances transitives actualisées, seuil CI critique. Audit npm : 15 → 9 paquets signalés, 3 → 0 critiques ; neuf alertes restent ouvertes. Lot 10.5.377 : docs/DEPENDENCIES_10_5_377.md. F9 et le reste de F8 restent ouverts.
  Validation du lot : 959 tests unitaires et 74 scénarios navigateur réussis. APK com.travelbudget.app 10.5.377 / 10050377 signé v2, bundle/Atlas/page embarqués identiques à dist. SHA-256 téléchargé depuis Supabase : 306549A9E1CC9818FB36D0335FCC9B5DC14B6A9F2D77C7320B8E1AF9176A770F. Validation téléphone restante.

- 23 octobre 2026 — lot 10.5.378, F9 partiel : bibliothèques CDN remplacées par des distributions npm locales verrouillées, graphiques différés, ECharts 6.1.0 corrigé avec thème v5 ; mesure du démarrage anonyme et garde-fous CI. Voir docs/STARTUP_10_5_378.md. Parcours connecté, téléphone et extraction legacy restent ouverts.
  Validation locale : 961 tests unitaires / 146 fichiers, 80 scénarios Playwright, contrôle documentaire et budgets réussis. Mesure compilée anonyme : 44 scripts, 1372,6 KiB JS décompressé ; aucun moteur graphique demandé. Reprise réseau et rechargement PWA hors ligne après mise en cache vérifiés.
  APK 10.5.378 / 10050378 signé v2, bundle/Atlas/page et tous les fichiers vendor embarqués identiques à dist. Téléchargement Supabase vérifié : SHA-256 9F29046A98C8299D329A216D70C7E5420D103885EB4204038BC70EAECB5A8214. Validation téléphone/session réelle restante.
