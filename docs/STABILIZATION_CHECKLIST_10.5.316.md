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

- 45 scenarios au total.
- 23 `OK`.
- 16 `Pas OK`, dont 3 correspondant a la decision de supprimer Cautions.
- 3 scenarios A traiter laisses `A refaire` volontairement.
- 3 scenarios Notifications non commences volontairement.
- Modules les plus proches de la validation : Analyse, Alimentation et Aide.

## Socle transversal

- [ ] Corriger les textes francais corrompus (`Libell?`, `avanc?`, `R?f?rence`, `Non class?`, `A ? B`).
- [ ] Remplacer les rejets metier `Uncaught (in promise)` par un message utilisateur explicite.
- [ ] Verifier l hydratation Nutrition/KPI sans ouverture prealable du module.
- [ ] Corriger l apercu documentaire et la politique CSP sans autorisation trop large.
- [ ] Auditer les 13 liens Trip/Transactions incomplets avant toute reparation automatique.

## Chantier 1 - Dashboard

- [x] Analyser les retours : 5 scenarios OK, 1 Pas OK.
- [x] Corriger la composition du Hero en theme sombre.
- [x] Faire recreer la courbe quand le theme change.
- [x] Eviter l erreur console offline transitoire pendant une mutation wallet.
- [x] Conserver wallets, budget journalier, KPI, projection et convertisseur.
- [x] Ajouter les contrats clair/sombre, re-rendu courbe et garde online wallet.
- [x] Verifier 1440 px et 390 px, clair et sombre.
- [ ] Faire retester Dashboard avant de le rouvrir.

Artefact de retest : `travelbudget-10.5.317-20260801-193954-debug.apk`.
SHA-256 : `E607988790BDDF27BB8E0E8FF0EB73BBF39674A5912E5ABDE95FE158BDCBB401`.

## Chantier 2 - Transactions

- [ ] Bloquer l edition des mouvements internes avant l appel RPC.
- [ ] Expliquer que la modification passe par les actions de transfert wallet.
- [ ] Decider si `Immobilisation / Immo` devient une categorie par defaut.
- [ ] Retester les filtres, le cycle CRUD et les transactions protegees.

## Chantier 3 - Settings

- [ ] Aligner email, WhatsApp, naissance et poids.
- [ ] Unifier ou clarifier les sauvegardes du compte.
- [ ] Retirer l encart Notification mobile demande.
- [ ] Ajouter une periode depuis la section Periodes.
- [ ] Corriger les champs numeriques contenant une devise, dont `400 EUR`.
- [ ] Gerer proprement les refus de suppression voyage/periode.
- [ ] Completer renommage, ordre, couleur et cycle de vie des categories.

## Chantier 4 - Analyse

- [ ] Retirer le log `active travel transactions loaded` hors mode debug.
- [ ] Prouver que Tresorerie pure utilise seulement les flux reels.
- [ ] Ajouter un contrat distinguant reel, prevision et budget.
- [ ] Retester puis rouvrir Analyse.

## Chantier 5 - Trip / Partage

- [ ] Selectionner Moi par defaut dans Paye par / Recu par.
- [ ] Autoriser un libelle vide avec valeur de secours explicite.
- [ ] Simplifier l audit des liens et distinguer visuellement les anomalies.
- [ ] Proposer Reparer seulement quand l operation est sure, sinon Support.
- [ ] Auditer les 13 liens existants.

## Chantier 6 - Sport

- [ ] Clarifier le choix du timer et eviter deux parcours concurrents.
- [ ] Ne pas afficher une distance avant sa saisie.
- [ ] Remplacer Arreter par Fini lorsque la seance est terminee.
- [ ] Compacter l historique ancien en conservant les sept dernieres seances detaillees.
- [ ] Harmoniser et auto-calculer les mesures corporelles derivables.

## Chantier 7 - Alimentation

- [ ] Hydrater les KPI au demarrage.
- [ ] Retirer les informations en double.
- [ ] Expliquer l ajustement calorique du prochain repas.
- [ ] Revoir Sommeil, Historique, Alcool et la chronologie de l eau.

## Chantier 8 - Travail

- [ ] Corriger le passage FR/EN.
- [ ] Retirer ou rendre informatif le BMR dans Travail.
- [ ] Reproduire le scenario Revenu marque Pas OK sans note.
- [ ] Permettre affichage, ajout et liaison des documents depuis Travail.

## Chantier 9 - Patrimoine

- [ ] Expliquer Inclure au budget et son effet.
- [ ] Clarifier les actions sous les actifs.
- [ ] Regrouper transactions et documents au meme niveau.
- [ ] Afficher la progression de l ajout documentaire.
- [ ] Permettre modification et apercu direct du document lie.
- [ ] Corriger l avertissement CSP.

## Chantier 10 - Cautions

- [ ] Inventorier les appels depuis navigation, Transactions, Documents, Inbox et notifications.
- [ ] Verifier les donnees existantes avant retrait.
- [ ] Archiver ou migrer les donnees si necessaire.
- [ ] Retirer interface, lazy-load, tests et documentation.
- [ ] Ajouter un contrat empechant le retour du module.

## Chantier 11 - Documents

- [ ] Corriger les textes francais.
- [ ] Moderniser le bandeau lateral sans perdre les commandes.
- [ ] Verifier l apercu et les liens metier apres la correction CSP.

## Chantier 12 - Aide

- [ ] Expliquer le diagnostic technique avec une aide utilisateur.
- [ ] Ajouter une voie de contact support.
- [ ] Corriger le masquage et la persistance de Demarrage rapide.

## Tests differes volontairement

- [ ] A traiter : chargement/compteurs, filtres/recherche, actions sources.
- [ ] Notifications : centre/compteur, lecture/navigation, preferences mobiles.

## Reprise Play Store

- [ ] Tous les modules critiques sont rouverts apres retest.
- [ ] Une passe transversale est faite sur l APK Android.
- [ ] Un AAB release candidate signe est produit et verifie.
- [ ] Le chantier `docs/PLAY_STORE_READINESS.md` reprend seulement apres ces gardes.
