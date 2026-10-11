# Suivi des corrections — ordre demandé le 10 octobre 2026

Le rapport `AUDIT_PROJET.md` reste le constat de référence daté ; les corrections sont suivies ici sans réécrire les preuves initiales.

1. **Capacitor Android — corrigé et APK distribué** : Android 8.5.3, CLI 8.5.3 et Core 8.5.0 verrouillés ; APK 10.5.373 reconstruit et publié, signature et empreinte distante vérifiées. 935 tests et 4 E2E ciblés réussis. Push `532710e` et page Projet/Atlas publics vérifiés le 11 octobre 2026. Validation sur téléphone restante (aucun appareil connecté). Preuves : `docs/ANDROID_SECURITY_10_5_373.md`.
2. **Architecture et qualité — en cours** : premier lot sur la couverture syntaxique, la chaîne de validation GitHub, les arrêts sur erreur des commandes Android et la reproductibilité de l'Atlas. Voir `docs/QUALITY_PIPELINE.md`. Dépendances, mesure du démarrage et extraction progressive restantes.
3. **Base de données — à venir** : autorisations des RPC, politiques et index, traitement différé et vérifications en base.
4. **Problèmes fonctionnels importants — à venir** : synchronisation, impact budgétaire, Nutrition, Sport et Trip, avec tests de panne et relecture de persistance.

Conserver les modifications Trip déjà présentes. Le 11 octobre 2026, l'utilisateur autorise le push, la publication de la page Projet avec l'APK, la mise à jour de l'Atlas puis la poursuite de l'étape architecture et qualité.
