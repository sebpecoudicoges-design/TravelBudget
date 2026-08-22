# Abonnements — prochaine checklist

Version de cadrage : `10.5.354`.

## Etat de l association

- Une transaction porte au maximum un `recurring_rule_id`.
- Le rattachement individuel et le rattachement multiple utilisent les RPC securises du domaine.
- Le proprietaire authentifie et le voyage commun restent obligatoires.
- Une echeance generee peut etre reclassee seulement apres confirmation; elle devient alors manuelle et ne peut plus etre reecrite par sa regle d origine.
- Les devises et les flux differents sont autorises apres avertissement. Le prevu garde les caracteristiques de la regle et le reel celles de la transaction.
- La base active compte 264 transactions liees : 233 generees et 31 manuelles. Aucun lien orphelin, inter-compte ou inter-voyage n a ete detecte lors du controle confirme le 22/08/2026.
- Les 15 regles actives ont toutes au moins une transaction. Trois regles ont deja des paiements dans une autre devise; aucune ne melange entree et sortie.
- La cle etrangere utilise `ON DELETE SET NULL`; les index couvrent la chronologie et l unicite regle/date.

## Etape 1 — fermer le socle actuel

- [x] Afficher toutes les regles actives du voyage dans les trois parcours Transaction.
- [x] Avertir avant une association inter-flux ou inter-devise.
- [x] Separer le prevu de la regle et le reel de la transaction.
- [x] Empiler les devises et supprimer tout debordement du resume financier.
- [x] Verifier clair/sombre a 1440 et 390 px.
- [ ] Faire executer les neuf retests Abonnements encore a faire.
- [ ] Clore globalement les scenarios valides avant d ouvrir le chantier suivant.

## Etape 2 — association assistee

- [x] Proposer, sans enregistrer automatiquement, les abonnements probables selon libelle, montant, devise et proximite de date.
- [x] Afficher un niveau de confiance et les raisons de chaque suggestion.
- [x] Creer une file **Transactions sans abonnement** avec validation unitaire.
- [ ] Ajouter la selection multiple apres validation du scoring unitaire en conditions reelles.
- [x] Memoriser uniquement les associations confirmees par l utilisateur pour ameliorer les suggestions suivantes.
- [x] Detecter les doublons probables entre une echeance generee et une transaction importee avant tout rattachement.

## Etape 3 — fiche abonnement et ecarts

- [x] Ouvrir une fiche detaillee depuis chaque ligne : prevu, reel, historique, prochaine echeance et transactions liees.
- [ ] Montrer les ecarts de montant, de date et de devise sans convertir implicitement.
- [x] Distinguer clairement generee, confirmee, modifiee, detachee et rattachee manuellement dans l historique existant.
- [ ] Completer la fiche avec les actions Detacher et une lecture d ecarts montant/date/devise.
- [ ] Signaler un abonnement sans paiement recent ou une hausse inhabituelle, sans modifier les donnees.

## Etape 4 — design et accessibilite

- [ ] Remplacer les longs formulaires par un panneau progressif **Essentiel / Planification / Classement**.
- [x] Conserver le resume en trois cartes compactes sur desktop et une pile lisible sur mobile.
- [x] Afficher les quatre onglets Abonnements en grille 2 x 2 a 390 px.
- [ ] Ajouter une legende textuelle aux nuances Entree, Sortie, Retard et Modification.
- [ ] Concevoir les etats vide, chargement, erreur, hors ligne et aucune association suggeree.
- [ ] Verifier clavier, focus visible, lecteurs d ecran, cibles tactiles et contraste clair/sombre.
- [ ] Ajouter des contrats visuels a 1440, 900, 600 et 390 px avec montants multidevises longs.

## Ordre recommande

Le prochain chantier recommande est **Association assistee et fiche abonnement**. Il commence par la file des transactions non rattachees et des suggestions explicables, puis ajoute la fiche detaillee. Les alertes et l automatisation viennent seulement apres validation manuelle de ce socle afin d eviter les associations silencieuses et les doublons.

## Definition de fini

- Aucune association automatique irreversible.
- Aucun melange implicite de devise ou de flux.
- Historique et origine du lien toujours visibles.
- RLS, proprietaire et voyage verifies par tests SQL.
- Contrats unitaires, fonctionnels et visuels verts.
- Onglet Tests, Atlas, page Projet et fresque chronologique a jour.
