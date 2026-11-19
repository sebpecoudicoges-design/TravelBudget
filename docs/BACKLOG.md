# Fonctionnalités à planifier

## Ordre demandé le 20 novembre 2026

1. Terminer et valider le lot Android/OAuth local en cours, conserver l'avancement Play Store.
2. Reprendre les corrections de l'audit : fiabilité des données, architecture/qualité, puis dette SQL et problèmes fonctionnels restants. Suivi dans [le point d'audit](AUDIT_STATUS_2026_11_04.md).
3. Améliorer le visuel et l'expérience de l'application : partir des écrans existants, préserver les fonctionnalités et appliquer `VISUAL_SYSTEM.md`, avec vérification clair/sombre à 1440 et 390 px.
4. Passer aux publicités réelles Android : finaliser AdMob, vérifier consentement et éligibilité, préparer une version signée de diffusion avec les unités de production. Conserver les annonces de test dans les builds debug et les tests de développement. Le compte et l'association boutique devront être revérifiés au démarrage de ce lot.
5. Reprendre la publication Play Store : fiche TravelBudget / `fr.pecloud.travelbudget`, France, support `seb.pecoud.icoges@gmail.com`, bundle signé et test fermé. Les testeurs restent à recruter. Détails et tâches restantes dans [le suivi Play Store](PLAY_STORE_READINESS.md).

La publication Play Store est différée à cette séquence ; les préparatifs existants sont conservés. Aucune activation commerciale ni publication ne découle de cette seule inscription au backlog. Si AdMob exige une association à la boutique avant la diffusion réelle, traiter cette dépendance avec le lot Play Store.

## Suivi prioritaire — quote-part « Avance Hostel »

Signalement du 20 novembre 2026 : dépense Trip du 18 novembre, montant total 11,70 EUR, budget du 20 au 21 novembre ; part absente du budget journalier « Today ». Lecture serveur ciblée : part personnelle de 5,85 EUR présente et liée, dates correctes. Cause : le filtre du budget rejetait le mot « Avance » dans le nom d'une quote-part sans identifiant Trip direct sur la transaction. Correction locale du prédicat ; le paiement brut reste exclu du budget par ses indicateurs et la quote-part ne crée pas de sortie wallet. Attendu : 2,925 EUR par jour avant conversion/arrondi. À valider après livraison web et reconstruction Android ; aucune donnée financière modifiée pour ce diagnostic.

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
