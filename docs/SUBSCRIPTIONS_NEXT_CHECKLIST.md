# Abonnements — prochaine checklist

Version de cadrage : `10.5.353`.

## Etat de l association

- Une transaction porte au maximum un `recurring_rule_id`.
- Le rattachement individuel et le rattachement multiple utilisent les RPC securises du domaine.
- Le proprietaire authentifie et le voyage commun restent obligatoires.
- Une echeance generee peut etre reclassee seulement apres confirmation; elle devient alors manuelle et ne peut plus etre reecrite par sa regle d origine.
- Les devises et les flux differents sont autorises apres avertissement. Le prevu garde les caracteristiques de la regle et le reel celles de la transaction.
- La base active compte 264 transactions liees : 233 generees et 31 manuelles. Aucun lien orphelin, inter-compte ou inter-voyage n a ete detecte le 16/08/2026.
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

- [ ] Proposer, sans enregistrer automatiquement, les abonnements probables selon libelle, montant, devise et proximite de date.
- [ ] Afficher un niveau de confiance et les raisons de chaque suggestion.
- [ ] Creer une file **Transactions sans abonnement** avec validation unitaire ou multiple.
- [ ] Memoriser uniquement les associations confirmees par l utilisateur pour ameliorer les suggestions suivantes.
- [ ] Detecter les doublons probables entre une echeance generee et une transaction importee avant tout rattachement.

## Etape 3 — fiche abonnement et ecarts

- [ ] Ouvrir une fiche detaillee depuis chaque ligne : prevu, reel, historique, prochaine echeance et transactions liees.
- [ ] Montrer les ecarts de montant, de date et de devise sans convertir implicitement.
- [ ] Distinguer clairement generee, confirmee, modifiee, detachee et rattachee manuellement.
- [ ] Ajouter les actions contextuelles Modifier la regle, Rattacher, Detacher et Ouvrir la transaction.
- [ ] Signaler un abonnement sans paiement recent ou une hausse inhabituelle, sans modifier les donnees.

## Etape 4 — design et accessibilite

- [ ] Remplacer les longs formulaires par un panneau progressif **Essentiel / Planification / Classement**.
- [ ] Conserver le resume en trois cartes compactes sur desktop et une pile lisible sur mobile.
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
