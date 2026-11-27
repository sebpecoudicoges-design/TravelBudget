# Point d'audit — 24 novembre 2026

Ce point remplace les anciens états de livraison du tableau du 4 novembre, sans effacer les preuves historiques. Le dépôt a été relu le 24 novembre. Les résultats SQL ci-dessous proviennent des interventions documentées ; les advisors de production n'ont pas été réinterrogés aujourd'hui.

## Livraisons et validation

- Web : 10.5.396, commit `bf5daa6f`, déploiement Netlify `6b03e18dcdfe49dd9c4679d0`, CI `45126530952` réussie lors de la livraison. Page Projet, Atlas et sources distantes vérifiés.
- APK public : 10.5.395, identité, signature, contenu embarqué et SHA-256 distant vérifiés. Il n'inclut pas les derniers correctifs Nutrition de la 10.5.396.
- Appareil : Galaxy A54 mis à jour de 10.5.392 vers 10.5.394 ; démarrage, session et bannière de test observés. Diagnostic du précache et essai isolé de la liste corrigée réussis. La 10.5.395 n'a pas été installée avant le débranchement.
- Validation du lot publié : 1 265 tests / 181 fichiers, huit parcours Nutrition, quatre contrôles Projet et CI complète réussis. Ces tests ne certifient pas tous les parcours métier sur compte réel.

## Avancement par priorité

| Priorité | Acquis | Reste à faire |
|---|---|---|
| 1. Android / F1 | Runtime vulnérable remplacé ; dépendances actuelles android/cli 8.5.3, core 8.5.0 ; APK redistribués | Installer et vérifier le dernier APK, puis tester OAuth, documents, notifications et réseau faible |
| 2. Architecture et qualité / F2, F4, F8–F10 | Reprise des chargements, isolation par compte, révisions de file, verrou de rejeu, lectures strictes, garde des écritures périmées ; tests et budgets en CI | Persistance transactionnelle entre onglets, conflits distants, autres moteurs, essais réels et couverture sémantique supplémentaire |
| 3. Base de données / F11 | Index wallet identique retiré avec contrôles ; opérations Trip et Sport renforcées | Actualiser les advisors ; examiner privilèges RPC, RLS, paramètres Auth et autres index, sans déduire leur état actuel de la mesure du 5 novembre |
| 4. Fonctionnel / F3–F7, F12–F15 | Correctifs budgets/Trip, comptabilité, pointage, suppression de la limite à 200 repas, atomicité Sport/Trip | Validation croisée wallet/budget/analyse, CSP générale, reprise de suppression de compte, synchronisation comptable multi-appareil, cohérence de l'aide |

## Limites qui empêchent de clôturer l'audit

- **F2/F4** : les contrôles de révision et de lecture empêchent plusieurs pertes reproduites, mais localStorage n'offre toujours pas de transaction entre onglets. Une requête déjà envoyée peut aboutir après une suppression locale. Un conflit distant Nutrition reste en erreur à résoudre.
- **F3/F6/F7** : corrections serveur/client documentées ; tous les parcours financiers et Android réels ne sont pas validés. Les anciens états disant « prochain APK » ne décrivent plus la livraison actuelle, mais les limites appareil restent valables.
- **F5** : limite à 200 repas retirée, tests 201 et 5 000 entrées. Cela ne supprime pas le risque de quota plein.
- **F12** : CSP stricte sur le consentement MCP ; politique générale encore en Report-Only, confirmé dans netlify.toml.
- **F13** : reprise locale des demandes `processing` anciennes, acquisition conditionnelle et contrôle des acquittements. Une étape persistée avant Auth permet de réconcilier les demandes dont l'utilisateur a disparu après nettoyage confirmé. Les 19 scénarios dédiés passent ; migration et concurrence SQL réelle validées en conteneur isolé, y compris l'annulation concurrente (complément du 25 novembre). Le parcours PostgREST/Auth/Storage sur compte de test reste à valider avant activation. Migration distante non appliquée. Voir [le suivi dédié](ACCOUNT_DELETION_RECOVERY.md). Aucune purge de compte réel lancée pour cet audit.
- **F14** : données comptables manuelles encore locales ; le connecteur ne remplace pas une synchronisation avec restauration et conflits.
- **F15** : description erronée de la comptabilité corrigée localement dans `assistant-help/handler.js` ; destination `accounting` acceptée côté serveur/client et bouton traduit. Tests du contrat et quatre parcours clair/sombre 1440/390 réussis. Déploiement serveur/client et évaluation des réponses réelles encore nécessaires.

## Travail du 24 novembre

Complément local F4 sur le sommeil : cinq cas de lecture invalide reproduits avant correction (JSON cassé, null, tableau, ligne nulle, lecture refusée). Les sauvegardes et fusions refusent désormais ces données sans les remplacer. La validation stricte des collections est partagée avec les repas, ce qui retire la duplication de lecture/parsing. Les lectures tolérantes d'affichage sont conservées volontairement. Aucun changement de données utilisateur, de schéma ou de service distant.

## Prochaine séquence

Éprouver la purge F13 via les services Auth et Storage et les données Trip partagées dans un environnement de test avec compte dédié ; poursuivre ensuite la revue SQL. Le processeur réel via PostgREST, la migration et les invariants de concurrence ont passé les contrôles isolés décrits ci-dessous ; la purge et l'authentification HTTP restent simulées dans ce lot. Maintenir F2/F4 ouverts jusqu'à une vraie stratégie transactionnelle. Ne pas confondre amélioration technique, livraison web, APK distribué et validation sur téléphone.

Restent différés au backlog : visuels et ergonomie, publicités commerciales, publication Play Store, Google Agenda, sortie d'immobilisation, visuels boutiques et vidéos. Ils ne sont pas déclarés commencés ou terminés par ce point.

Validation finale du complément sommeil : quality complet réussi, 1 270 tests / 181 fichiers et quatre parcours Chromium (1440/390 px, clair/sombre). JS initial 278,9 / 279 KiB, total 879 / 879 KiB ; plafonds inchangés. Documentation et Atlas actualisés. Ce complément reste local, non publié, absent de la 10.5.396 en ligne et de l'APK 10.5.395. La version web et la réussite de sa CI ont été relues le 24 novembre.

Suite F13 : reprise conditionnelle du processeur et contrôle des cinq nettoyages auparavant non vérifiés, 14 scénarios dédiés réussis. Validation globale 1 284 tests / 183 fichiers et quality complet réussi. Le lot reste local et non activé ; concurrence SQL réelle, réconciliation après disparition Auth et reprise multi-services sur compte dédié restent nécessaires. Voir ACCOUNT_DELETION_RECOVERY.md.

Dernière validation F13, après ajout de l'étape avant Auth : **1 289 tests / 183 fichiers**, dont 19 scénarios dédiés, et chaîne quality complète réussie. Huit critères de sélection vérifiés sur PostgreSQL par valeurs synthétiques en lecture seule. La réconciliation après disparition Auth est couverte en simulation ; sa validation intégrée reste ouverte. Migration et fonction non déployées, aucune suppression réelle. Atlas actualisé ; aucun nouvel APK.

Suite F13 : migration réelle exécutée deux fois dans un PostgreSQL isolé et jetable, droits/RLS conservés, deux acquisitions concurrentes avec verrou SQL observé et un seul gagnant (pending et processing), acquittement périmé refusé, checkpoint conservé après mise à null de la référence Auth. Script reproductible `npm run test:sql:account-deletion`. Aucune donnée distante utilisée. Le parcours via PostgREST et les services Auth/Storage reste à vérifier avant déploiement ; F13 demeure ouvert.

Le premier passage SQL complet et son nettoyage ont réussi. La répétition finale a été interrompue par la disparition du moteur Docker, puis de son exécutable local ; le nettoyage de ce second conteneur et la revalidation du script final restent à faire lorsque Docker sera disponible. Voir le suivi F13 pour les limites exactes.

**Complément du 25 novembre :** réserve Docker levée. Ancien conteneur identifié et nettoyé avec son volume, absence vérifiée. Script SQL final entièrement réussi, avec deux contrôles supplémentaires sur l'annulation avant/après prise en charge. Nettoyage des nouveaux conteneurs confirmé. Atlas et documentation actualisés ; pas de changement applicatif, de déploiement ou de nouvel APK. Prochaine étape F13 : parcours intégré PostgREST/Auth/Storage sur compte de test.

**Suite du 25 novembre :** revue complète d'Analyse ajoutée au [backlog](BACKLOG.md), avec cohérence des données et examen de chaque graphique (besoin, sources, formule, inclusions/exclusions et rapprochement chiffré). Revue non commencée. Côté F13, troncature silencieuse de l'inventaire à 50 000 lignes reproduite et remplacée par un arrêt explicite au-delà du plafond ; limite exacte vérifiée. 21 tests ciblés et contrôles serveur réussis. Aucun déploiement.

**Validation PostgREST du 25 novembre :** véritable processeur et client Supabase 2.57.4 exécutés contre PostgREST/PostgreSQL locaux. Sélection/exclusions, concurrence et reprise après échec du statut final validées. Script reproductible `npm run test:rest:account-deletion`. Authentification HTTP et purge encore simulées ; Auth/Storage/Trip réels restent à éprouver. Conteneurs nettoyés. Aucun changement applicatif supplémentaire ni déploiement pour cette étape.

**Complément Trip du 25 novembre :** la véritable fonction de purge passe aussi sur des fixtures PostgreSQL persistées : échec Storage simulé, transfert partiel interrompu, reprise conservant dépenses/quote-part et anonymisation du membre sortant. Tests REST complets et typage validés, conteneurs nettoyés. Auth/Storage restent simulés et les fixtures ne reproduisent pas les contraintes du schéma métier ; les autres cas de propriété Trip et les services réels restent à vérifier. F13 demeure ouvert, sans déploiement.

**Correction des liens budgétaires du 25 novembre :** intégration du véritable trigger d'intégrité dans le banc local. Reproduction d'un transfert interdit de lien personnel vers le successeur ; correction en conservant sa suppression filtrée par propriétaire, sans transfert. Test REST réussi : lien/transaction du compte sortant retirés, ceux de l'autre participant intacts. Les autres cas de propriété Trip restent ouverts. Correctif local, non déployé.

**Contributions Trip du 25 novembre :** perte d'historique reproduite puis corrigée pour un compte qui contribue à un voyage possédé par un tiers. Découverte via les lignes partagées, conservation des dépenses/quotes-parts/remboursements sous le propriétaire existant, sans changement de propriétaire du groupe ; membre anonymisé. Test PostgreSQL/PostgREST réussi même sans ligne de participant, ainsi que les 21 tests ciblés. Auth/Storage réels, schéma complet, absence de successeur et mutations concurrentes restent à valider. Aucun déploiement.

**Cas limites Trip du 25 novembre :** tests PostgreSQL/PostgREST supplémentaires réussis pour l'échec de découverte des groupes (arrêt avant suppression de leurs lignes et Auth), le voyage sans successeur authentifié et le recours à un membre authentifié sans ligne de participant. Les dépenses étrangères restent intactes. Aucun changement applicatif ni déploiement dans ce complément ; services réels, contraintes/cascades restantes et concurrence des changements de participants restent ouverts.

**Accès au processeur du 25 novembre :** 11 tests du véritable point d'entrée ajoutés : refus des secrets absents/incorrects, configuration manquante, méthodes interdites et prévol sans traitement ; POST autorisé et erreur serveur contrôlés. 32 tests F13 ciblés réussis. Backend simulé, sans serveur HTTP réel ni passerelle déployée ; cette validation ne couvre pas JWT, Auth/Storage ou rotation du secret. Aucun changement applicatif ni déploiement.

**Réponse Auth perdue du 25 novembre :** blocage en échec définitif reproduit puis corrigé pour les erreurs après checkpoint. La demande reste reprenable, sans déclarer de succès ; réconciliation si l'utilisateur a disparu, nouvelle tentative s'il existe encore. 34 tests ciblés, scénario PostgreSQL/PostgREST et suite complète **1 304 tests / 184 fichiers** réussis. Les erreurs Auth persistantes peuvent se répéter après expiration du délai ; services réels et supervision restent à valider. Correctif local, non déployé.

**Périmètre Storage du 25 novembre :** références de fichiers auparavant acceptées sans contrôle de leur appartenance au compte. Garde-fou commun ajouté avant suppression et création de liens signés d'export ; seuls les formats personnels et WhatsApp du compte sont admis. Sept refus reproduits avant correction ; 44 tests F13 ciblés passent après correction, formats légitimes inclus. Exploitation non démontrée ; aucun objet utilisateur manipulé. Les références historiques non reconnues devront être examinées. Correctif local, non déployé.

**F15 — aide comptable, 25 novembre :** suppression de l'affirmation obsolète niant l'existence du module. Description des vues réellement présentes, distinction résultat/trésorerie et limites des paramètres locaux. Route `accounting` ajoutée aux deux listes autorisées, libellé Comptabilité/Accounting ajouté au bouton existant. Contrat serveur-client et quatre parcours Playwright réussis, captures 390 sombre et 1440 clair inspectées. Réponses IA simulées ; aucune évaluation en ligne ni publication dans ce lot. Les autres capacités de l'aide restent à revoir avant clôture globale de F15.

Validation finale locale après ce lot : **quality complet réussi, 1 315 tests / 184 fichiers**, compilation, documentation et budgets inclus ; quatre parcours aide Playwright clair/sombre 1440/390 réussis. Plafonds inchangés (JS initial 278,9/279 KiB, total 879/879 KiB). Ce passage complet inclut les correctifs F13 précédents et dépasse le passage Storage interrompu par un timeout. Toujours sans push, déploiement ni nouvel APK dans cette séquence locale.

**F15 — parcours comptabilité en continu, 28 novembre :** deux parcours Chromium FR/EN relient le panneau d’aide et son vrai client au gestionnaire Edge versionné via un transport local. Authentification, quota et fournisseur IA sont simulés. Une réponse prévue ouvre Comptabilité ; quand le fournisseur simulé est indisponible, la vraie aide locale explique la distinction résultat/portefeuille dans la bonne langue. Le navigateur et le gestionnaire transmettent seulement question, langue et vue, sans les écritures fictives affichées dans le contexte de l’app. Le workflow de la branche d’audit exécute ces parcours. Ceci ne valide ni Supabase déployé ni la qualité d’un modèle réel, et ne modifie pas le comportement de production.
