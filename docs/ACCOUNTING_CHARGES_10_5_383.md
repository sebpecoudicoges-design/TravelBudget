# Charges et résultat comptable — 10.5.383

## Diagnostic

Le résultat affiché surestimait la différence entre produits et charges : la soustraction était correcte, mais certaines charges étaient exclues à tort.

La première transaction rencontrée initialisait le compte partagé de sa catégorie et sous-catégorie. Une quote-part Trip interne pouvait donc enregistrer 512100 et exclure aussi les dépenses ordinaires suivantes. La lecture de l’interface réelle a confirmé des affectations de charges à 512100 avec origine « Déduction initiale ». Les quotes-parts personnelles Trip étaient elles-mêmes exclues du résultat.

## Correction

Les quotes-parts personnelles Trip participant au budget entrent dans le résultat selon leurs dates budgétaires et leur conversion de devise. Le décaissement brut Trip hors budget reste exclu. Les virements internes véritables restent exclus, indépendamment du libellé. Les quotes-parts n’ajoutent aucune régularisation : les soldes Trip fournissent déjà leurs créances et dettes.

La classification locale passe à la version 4. Seuls les comptes bancaires de version 3 encore identiques au marqueur automatique sont réévalués. Les choix manuels, Auto explicite et autres déductions sont préservés. Aucun montant, catégorie, transaction ou solde Supabase n’est modifié. Les mouvements internes ne peuvent plus initialiser une affectation partagée.

La recherche du code directement lié a conduit à remplacer l’exclusion générale obsolète et sa documentation ; aucun autre code inutilisé n’a été identifié dans ce périmètre.

## Validation et livraison

Les régressions couvrent l’ordre des transactions, la migration idempotente, les choix manuels, le prorata, les périodes futures, les parts de revenu, les virements et l’absence de dette Trip comptée deux fois. Les scénarios navigateur contrôlent la persistance de la réparation en clair/sombre à 1440/390 px. Les totaux attendus des scénarios comptables incluent désormais les quotes-parts.

APK : `travelbudget-10.5.383-20261026-120100-debug.apk`, package `com.travelbudget.app`, versionCode `10050383`. Page Projet et Atlas actualisés. Les résultats des contrôles et preuves de livraison sont consignés dans le suivi de l’audit. La validation sur téléphone reste distincte des tests navigateur et des contrôles du paquet.
