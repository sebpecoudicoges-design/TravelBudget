# TravelBudget - checklist de stabilisation 10.5.316

Source : campagne Supabase `stabilisation-modules-10-5-316`, compte testeur principal, 1er aout 2026.

## Regle de passage

Chaque module reste ferme aux comptes standards jusqu a ce que son lot respecte les conditions suivantes :

- tous les retours `Pas OK` du module sont traites ou documentes comme decision produit ;
- les notes ajoutees a des scenarios `OK` ont ete relues et classees ;
- les parcours utiles, identifiants et attributs `data-*` restent disponibles ;
- les tests cibles, la syntaxe, le build et les budgets passent ;
- le rendu clair/sombre est verifie a 1440 px et 390 px ;
- le testeur refait le module et le cloture `Tout est OK` ;
- le module peut alors etre rouvert aux comptes standards.

## Etat de la campagne

- Version cible de campagne : `10.5.343`.
- 14 modules actifs et Cautions archive apres retrait de son interface.
- 60 resultats et 16 revues de module traitees sont archives avec date de test, date de traitement, version et note.
- Le retest Categories Settings valide est clos globalement en `10.5.342`. Quatre retests sont ajoutes avec filiation : actions internes Wallet, scopes KPI/courbe, sous-categories des regles recurrentes et connexion sans gel. Les autres retours ouverts gardent leur scenario d origine.
- Dashboard, Transactions et Analyse sont valides puis rouverts aux comptes standards ; les autres modules metier restent geles.
- A traiter et Notifications restent volontairement non testes ; le filtre **Sans test** permet de les isoler.

## Socle transversal

- [x] Corriger les textes francais corrompus reperes (`Libell?`, `avanc?`, `R?f?rence`, `Non class?`, `A ? B`) et ajouter un contrat i18n.
- [ ] Remplacer les rejets metier `Uncaught (in promise)` par un message utilisateur explicite.
- [ ] Verifier l hydratation Nutrition/KPI sans ouverture prealable du module.
- [x] Corriger l apercu documentaire et limiter `frame-src` aux contenus locaux, `blob:` et Supabase.
- [x] Rendre les 13 liens Trip/Transactions incomplets identifiables sans exposer les UUID ; la reparation reste guidee et non automatique.
- [x] Reprendre le retour Archiver wallet : remplacer la disposition inline par un panneau d actions explicitement contenu dans la carte, avec contrats desktop/mobile et clair/sombre.

## Chantier 1 - Dashboard

- [x] Analyser les retours : 5 scenarios OK, 1 Pas OK.
- [x] Corriger la composition du Hero en theme sombre.
- [x] Faire recreer la courbe quand le theme change.
- [x] Eviter l erreur console offline transitoire pendant une mutation wallet.
- [x] Conserver wallets, budget journalier, KPI, projection et convertisseur.
- [x] Ajouter les contrats clair/sombre, re-rendu courbe et garde online wallet.
- [x] Verifier 1440 px et 390 px, clair et sombre.
- [x] Forcer un rendu final apres la levee du verrou de boot pour afficher wallets, budget journalier et courbe sans changer de module.
- [x] Relancer ce rendu de facon bornee tant que les trois conteneurs critiques ne sont pas hydrates.
- [x] Faire retester Dashboard puis le rouvrir aux comptes standards en `10.5.328`.

Artefact de retest : `travelbudget-10.5.317-20260801-193954-debug.apk`.
SHA-256 : `E607988790BDDF27BB8E0E8FF0EB73BBF39674A5912E5ABDE95FE158BDCBB401`.

## Lot transversal - Interface generale

- [x] Aligner la page Projet sur les tokens officiels corail, lagon, ivoire et bleu petrole.
- [x] Supprimer de la page Projet les blocs Membres admins - tests a faire et Checklist de mise en ligne.
- [x] Ajouter l attribution proprietaire Pecloud et le lien externe securise vers `https://pecloud.fr/`.
- [x] Supprimer le JavaScript, les traductions et les styles devenus morts avec ces deux blocs.
- [x] Moderniser l ecran de chargement en conservant version, progression, phases et disparition a 100 %.
- [x] Ajouter les variantes sombre, desktop et mobile ainsi que les contrats anti-retour.
- [x] Laisser le choix clair, sombre ou systeme et memoriser la preference de la page Projet.
- [x] Adapter au sombre les heroes, bandeaux, en-tetes de section, panneaux modules et appel final.
- [x] Archiver les deux tests 10.5.318 traites et recreer uniquement le retest du hero sombre.
- [x] Ajouter deux scenarios dans l onglet Tests sans modifier les resultats existants.
- [ ] Faire valider ce lot par le testeur depuis le module Interface generale.

## Chantier 2 - Transactions

- [x] Bloquer l edition des mouvements internes avant l appel RPC.
- [x] Expliquer que la modification passe par les actions de transfert wallet.
- [x] Ajouter `Immobilisation` aux categories par defaut, la retro-propager sans doublon et l exclure du mix analytique quotidien.
- [x] Clore le retest Immobilisation et rouvrir Transactions aux comptes standards en `10.5.328`.
- [ ] Retester les filtres, le cycle CRUD et les transactions protegees.

## Chantier 3 - Settings

- [x] Aligner email, WhatsApp, naissance, poids, taille, devise et mode dans une grille responsive.
- [x] Unifier les sauvegardes du compte avec une validation complete avant la premiere ecriture.
- [x] Retirer l encart Notification mobile redondant ; le module Notifications dedie reste disponible.
- [x] Ajouter une periode depuis la section Periodes.
- [x] Corriger les champs numeriques contenant une devise, dont `400 EUR`, et remplacer le defaut arbitraire par le budget quotidien estime ou une valeur vide.
- [x] Gerer proprement les refus de suppression voyage/periode sans erreur console pour un refus metier attendu.
- [x] Completer renommage, ordre, couleur et cycle de vie des categories en `10.5.330`, archiver le retour et reutiliser son retest lie.
- [x] Clore globalement en `10.5.342` le retest gestion Categories `10.5.330`, valide par le testeur.
- [x] Reposer en `10.5.342` les ecouteurs de la modale Regles recurrentes apres son montage afin de rendre sous-categorie, frequence, wallet et devise selectionnables.
- [x] Faire executer le retest sous-categorie des regles recurrentes `10.5.342` : champs interactifs et valeurs enregistrees, mais ecart de reconciliation decouvert le 15/08/2026.
- [x] Rendre atomique en `10.5.343` l edition d une regle, detacher les echeances personnalisees et remplacer uniquement les projections mutables.
- [ ] Faire executer le retest descendant de reconciliation des regles recurrentes `10.5.343`.

## Chantier 4 - Analyse

- [x] Retirer le log `active travel transactions loaded` hors mode debug.
- [x] Prouver que Tresorerie pure utilise seulement les flux reels.
- [x] Ajouter un contrat distinguant encaissements reels, paiements reels et flux planifies.
- [ ] Retester puis rouvrir Analyse.

## Chantier 5 - Trip / Partage

- [x] Corriger le placeholder francais de recherche de l historique (`Libelle, montant, participant`).
- [x] Selectionner Moi par defaut dans Paye par / Recu par.
- [x] Autoriser un libelle vide avec valeur de secours explicite.
- [x] Simplifier l audit des liens et distinguer visuellement les anomalies en rouge.
- [x] Proposer Reparer comme ouverture guidee de la modification et preparer un contact Support avec diagnostic.
- [ ] Auditer les 13 liens existants.
- [ ] Faire executer le retest audit Trip `10.5.332` en clair/sombre et 1440/390 px.

## Chantier 6 - Sport

- [x] Clarifier le choix du timer et eviter deux parcours concurrents.
- [x] Ne pas afficher une distance avant sa saisie.
- [x] Remplacer Arreter par Fini lorsque la seance est terminee.
- [x] Aligner le premier chargement progression sur la colonne SQL `smoothed_1rm_kg` et supprimer la requete 400.
- [x] Compacter l historique ancien en conservant les sept dernieres seances detaillees et toutes les actions.
- [ ] Faire executer le retest chargement/historique Sport `10.5.334` en clair/sombre et 1440/390 px.
- [ ] Faire executer le retest choix du minuteur Sport `10.5.335`, puis saisir une distance reelle et sauvegarder.
- [x] Traiter le gel persistant du retest web Alimentation `10.5.336` en `10.5.338` et ouvrir un descendant web/mobile centre sur les ajouts et favoris.
- [x] Traiter en `10.5.339` la double synchronisation signalee apres les bulles et archiver le scenario `10.5.338` avec ses dates.
- [x] Traiter en `10.5.340` le reset de saisie provoque par les faux retours en ligne et les reconciliations pendant le focus.
- [x] Clore pour tous le retest saisie stable Alimentation `10.5.340`, confirme OK le 10/08/2026.
- [x] Harmoniser les mesures corporelles derivables et afficher graisse/muscle en kg et en % dans Evolution composition en `10.5.341`.
- [ ] Faire executer le retest evolution composition kg Sport `10.5.341` en clair/sombre et 1440/390 px.

## Chantier 7 - Alimentation

- [ ] Hydrater les KPI au demarrage.
- [ ] Retirer les informations en double.
- [ ] Expliquer l ajustement calorique du prochain repas.
- [ ] Revoir Sommeil, Historique, Alcool et la chronologie de l eau.

## Chantier 8 - Travail

- [x] Corriger le passage FR/EN.
- [x] Retirer le BMR du module Travail.
- [x] Corriger le scenario Revenu sans note en distinguant net, brut, periode et totaux par devise.
- [x] Permettre affichage, ajout et liaison des documents depuis une mission, un revenu ou une periode.
- [ ] Faire executer les trois retests descendants Travail `10.5.333` en clair/sombre et 1440/390 px.

## Chantier 9 - Patrimoine

- [x] Expliquer Inclure au budget et son effet coche ou decoche.
- [x] Clarifier les actions sous les actifs en les rangeant par fonction.
- [x] Regrouper transactions et documents au meme niveau dans une seule fenetre.
- [x] Conserver et expliciter la progression de l ajout documentaire.
- [x] Permettre modification et apercu direct du document lie sans changer de module.
- [x] Corriger l avertissement CSP sans autoriser toutes les frames externes.
- [x] Lire et traiter les trois retests Patrimoine `10.5.329` en `10.5.331` : aide budget concise, justificatifs regroupes et modification documentaire fiable.
- [ ] Faire executer les trois retests Patrimoine descendants `10.5.331` avant reouverture du module.

## Chantier 10 - Cautions

- [x] Inventorier les appels depuis navigation, Transactions, Documents, Inbox et notifications.
- [x] Verifier les donnees existantes : 5 cautions, toutes soldees, conservees pour historique/export/suppression de compte.
- [x] Archiver le module et ses retours de campagne sans supprimer les donnees metier historiques.
- [x] Retirer l interface, la navigation, le lazy-load et le script UI devenus morts.
- [x] Ajouter un contrat empechant le retour du module visible ou chargeable.

## Suivi et archives de tests

- [x] Conserver separement date du test (`tested_at`) et date de traitement (`treated_at`).
- [x] Archiver un resultat ou une revue sans effacer sa note ni son auteur.
- [x] Autoriser un nouveau retest actif apres archivage du resultat precedent.
- [x] Filtrer les modules actifs, a tester, sans test et archives.
- [x] Afficher ou masquer l historique des tests archives.

## Chantier 11 - Documents

- [x] Corriger les textes francais.
- [x] Moderniser le bandeau lateral sans perdre les commandes.
- [ ] Verifier l apercu et les liens metier avec les retests Patrimoine `10.5.331`.

## Chantier 12 - Aide

- [x] Expliquer le diagnostic technique avec une aide utilisateur.
- [x] Ajouter une voie de contact support.
- [x] Corriger le masquage et la persistance de Demarrage rapide.

## Tests differes volontairement

- [ ] A traiter : chargement/compteurs, filtres/recherche, actions sources.
- [ ] Notifications : centre/compteur, lecture/navigation, preferences mobiles.

## Reprise Play Store

- [ ] Tous les modules critiques sont rouverts apres retest.
- [ ] Une passe transversale est faite sur l APK Android.
- [ ] Un AAB release candidate signe est produit et verifie.
- [ ] Le chantier `docs/PLAY_STORE_READINESS.md` reprend seulement apres ces gardes.
