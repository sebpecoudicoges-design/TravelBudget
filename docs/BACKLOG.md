# Fonctionnalités à planifier

## Revue complète du module Analyse

Demande du 25 novembre 2026. Statut : **à planifier**, sans revue exhaustive commencée. À intégrer aux travaux de cohérence des données de l'audit.

- Inventorier tous les indicateurs, tableaux et graphiques, leurs sources et leurs règles de calcul ; examiner aussi les filtres, périodes, devises, arrondis et états sans données.
- Vérifier la cohérence entre Analyse, transactions, wallets, budgets, Trip et comptabilité, en expliquant les écarts légitimes entre trésorerie, consommation budgétaire et résultat.
- Pour chaque graphique, préciser le besoin utilisateur et la question à laquelle il répond ; vérifier si le type de graphique, les axes, unités, légendes et comparaisons servent ce besoin.
- Documenter les données incluses et exclues : dépenses/entrées, virements internes, remboursements, avances, paiements Trip bruts et quotes-parts personnelles, dépenses prépayées, éléments hors budget, biens et amortissements. Préserver le débit brut en trésorerie et éviter de compter deux fois paiement Trip et quote-part.
- Contrôler les dates de paiement et dates budgétaires, la ventilation sur plusieurs jours, les périodes passées/futures, les changements de devise et les filtres de catégories/sous-catégories.
- Balayer les graphiques un par un avec l'utilisateur : besoin, formule, périmètre, exemples chiffrés vérifiables, anomalies et décision (conserver, corriger, simplifier ou remplacer).

Livrable attendu : matrice par graphique avec besoin, sources, formule, inclusions/exclusions, rapprochement chiffré et statut. Ajouter des tests sur les écarts reproduits avant correction. Une somme cohérente avec un autre écran n'est pas suffisante si les deux utilisent une règle incorrecte. Toute modification visuelle devra respecter `VISUAL_SYSTEM.md` et préserver les commandes et filtres existants.

## Ordre demandé le 20 novembre 2026

Consigne du 22 novembre : poursuivre les corrections en local ; publication et reconstruction APK différées à une demande ultérieure.

Consigne suivante du 22 novembre : publication et reconstruction APK de nouveau autorisées lorsqu'elles sont nécessaires. Lot 10.5.394 préparé pour livrer les corrections de synchronisation et intégrer les correctifs web dans Android. Les chantiers AdMob commercial et Play Store restent distincts.

1. Terminer et valider le lot Android/OAuth local en cours, conserver l'avancement Play Store.
2. Reprendre les corrections de l'audit : fiabilité des données, architecture/qualité, puis dette SQL et problèmes fonctionnels restants. Suivi dans [le point d'audit](AUDIT_STATUS_2026_11_04.md).
3. Améliorer le visuel et l'expérience de l'application : partir des écrans existants, préserver les fonctionnalités et appliquer `VISUAL_SYSTEM.md`, avec vérification clair/sombre à 1440 et 390 px.
4. Passer aux publicités réelles Android : finaliser AdMob, vérifier consentement et éligibilité, préparer une version signée de diffusion avec les unités de production. Conserver les annonces de test dans les builds debug et les tests de développement. Le compte et l'association boutique devront être revérifiés au démarrage de ce lot.
5. Reprendre la publication Play Store : fiche TravelBudget / `fr.pecloud.travelbudget`, France, adresse de support configurée dans la console, bundle signé et test fermé. Les testeurs restent à recruter. Détails et tâches restantes dans [le suivi Play Store](PLAY_STORE_READINESS.md).

La publication Play Store est différée à cette séquence ; les préparatifs existants sont conservés. Aucune activation commerciale ni publication ne découle de cette seule inscription au backlog. Si AdMob exige une association à la boutique avant la diffusion réelle, traiter cette dépendance avec le lot Play Store.

## Suivi prioritaire — quote-part Trip absente du budget journalier

Une quote-part personnelle Trip correctement liée pouvait être absente du budget journalier. Cause : le filtre rejetait le mot « Avance » dans le nom d'une quote-part sans identifiant Trip direct sur la transaction. Correction du prédicat : le paiement brut reste exclu du budget par ses indicateurs et la quote-part ne crée pas de sortie wallet ; sa part budgétaire est répartie sur les jours concernés. Vérifier la livraison effective et le parcours appareil avant clôture. Les montants, libellés et dates de données utilisateur sont omis de ce document public.

## Sortie d'une immobilisation : casse, vol ou vente

Demande utilisateur du 20 novembre 2026. Statut : **à planifier**, sans implémentation à ce stade.

- Permettre de sortir un bien du patrimoine actif avec un motif : cassé, volé ou vendu, une date et une note/justificatif facultatifs.
- Conserver la fiche et son historique, arrêter les amortissements à la date de sortie et actualiser la valeur du patrimoine et les indicateurs comptables selon les règles retenues.
- Pour une vente : saisir le prix, la devise, la date d'encaissement et le wallet ; permettre de rattacher une transaction existante pour éviter un double revenu.
- Distinguer la sortie du bien de l'encaissement d'une vente ou d'une indemnisation éventuelle. Prévoir une correction/annulation traçable.

À préciser au démarrage : casse totale ou dépréciation partielle, remboursement d'assurance, calcul du résultat de sortie et traitement des dates rétroactives. Critères : pas de disparition de l'historique, pas d'amortissement après sortie, pas de double transaction lors d'une reprise ou d'un nouvel enregistrement. Cette demande ne modifie pas l'ordre des priorités ci-dessus.

## Google Agenda

Demande utilisateur du 4 novembre 2026. Statut : **à faire plus tard**, après reprise des priorités de l’audit ; implémentation non commencée.

- Connecter le compte Google Agenda de l’utilisateur à TravelBudget.
- Permettre de choisir les agendas à afficher ou masquer, avec mémorisation du choix.
- Afficher quotidiennement les rendez-vous du jour à proximité des KPI du Dashboard.
- Prévoir un espace Agenda dédié pour consulter les événements des agendas sélectionnés.

À préciser au démarrage : vues souhaitées dans l’espace Agenda, lecture seule ou modification des événements, comportement des fuseaux horaires en voyage et du mode hors ligne. Aucune création ou modification d’événement demandée à ce stade.

Critères à prévoir : un agenda masqué n’alimente ni les rendez-vous du jour ni l’espace Agenda ; les choix sont conservés ; les états sans rendez-vous, déconnecté et erreur de chargement sont explicites. Préserver les KPI existants et respecter le système visuel du dépôt.

## Précache Android — observation appareil du 23 novembre 2026

Sur Galaxy A54 après mise à jour 10.5.392 vers 10.5.394, le démarrage et la bannière sont visibles, mais le service worker remonte Cache.addAll: Request failed. Identifier la ressource en échec et vérifier le démarrage hors ligne sans supprimer les données ni les caches utilisateur à l'aveugle. Ce constat ne prouve pas une panne complète du mode hors ligne.

## Visuels boutiques et vidéos — à faire plus tard

Demande du 23 novembre 2026 : préparer les visuels de présentation pour les boutiques et créer des vidéos de l'application, après la correction des bugs observés sur appareil. À cadrer au démarrage : boutiques ciblées, captures, formats et langues, démonstration et durée. Utiliser des données de démonstration pour les supports publics. Aucun visuel ni vidéo produit à ce stade.
