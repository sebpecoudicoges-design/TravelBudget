# Checklist refonte visuelle V11

Objectif : appliquer progressivement le systeme visuel premium sans reconstruire les modules ni perdre de fonctions utiles.

Source obligatoire : [`VISUAL_SYSTEM.md`](VISUAL_SYSTEM.md).

## Methode par module

- [ ] Inventorier les donnees visibles, boutons, filtres, modales, etats vides, erreurs et gestes tactiles.
- [ ] Conserver les `id`, `data-*`, labels accessibles et gestionnaires existants.
- [ ] Reorganiser l'information autour d'une lecture simple : resume, action principale, details, historique.
- [ ] Utiliser les tokens de `src/ui/premium-theme.css` avant d'ajouter une valeur.
- [ ] Eviter les styles inline quand une classe `tb-*` peut porter la regle.
- [ ] Verifier clair, sombre, desktop 1440 px, tablette 900 px, mobile 390 px.
- [ ] Ajouter ou mettre a jour un test de contrat fonctionnel et visuel.
- [ ] Ajouter une ligne dans `docs/MANUAL_TESTS.md` si un test utilisateur specifique est necessaire.
- [ ] Mettre a jour `public/projet.html` quand une APK est livree.

## Lots de refonte

### Lot 1 - Base visuelle et Dashboard

- [x] Centraliser la palette corail, lagon, ivoire et bleu petrole.
- [x] Charger le theme premium depuis l'entree Vite.
- [x] Ajouter `VISUAL_SYSTEM.md` et la consigne `AGENTS.md`.
- [x] Moderniser la navigation en groupes sans retirer les onglets.
- [x] Moderniser Dashboard/KPI sans retirer wallets, budget journalier, projection ni convertisseur.
- [x] Verrouiller les tests de contrat visuel.
- [x] Nettoyer l'onboarding Dashboard : styles inline lourds remplaces par classes premium, actions `data-dashboard-action` conservees, mobile 390 px couvert par contrat.
- [x] Corriger le placement des boutons Archiver wallet dans chaque carte Dashboard, avec contrat CSS anti-retour.
- [x] Aligner la page Projet publique et l ecran de chargement sur la palette premium, avec clair/sombre, desktop/mobile et retrait des anciens panneaux de suivi internes.
- [x] Ajouter a la page Projet un choix clair/sombre/systeme persistant et adapter tous ses heroes au theme sombre.

### Lot 2 - Transactions

- [ ] Inventorier liste, filtres, bulk actions, modales ajout/edition, paiement, statut et factures.
- [x] Premier lot : panneau aide Transactions extrait vers vue pure, actions hook-based, pas de CSS specifique ajoute.
- [x] Premier lot filtres : style inline du panneau principal retire de `index.html`, rendu porte par le theme premium sans masquer les criteres avances.
- [x] Stabiliser le champ Recherche des filtres avec une classe explicite `.tx-filter-search`, y compris sur mobile Capacitor.
- [ ] Rendre les filtres plus lisibles sans masquer les criteres avances.
- [ ] Harmoniser les cartes/lignes transaction avec montant, devise, statut, date et budget.
- [ ] Verifier mobile : pas de debordement horizontal, actions accessibles.
- [x] Ajouter test contrat Transactions premium.

### Lot 3 - Analyse

- [ ] Inventorier cartes, filtres, graphiques, drilldown, FX decision et references.
- [ ] Mettre en avant trajectoire, ecarts, rythme et signaux sans casser les graphiques.
- [ ] Conserver selection de voyage, periode, date a date et details au clic.
- [ ] Verifier que les donnees remontent des l'ouverture sans double refresh inutile.
- [ ] Ajouter test contrat Analyse premium.

### Lot transversal - Settings Categories

- [x] Regrouper les actions de chaque categorie dans sa carte : ordre, modifier, ajouter une sous-categorie et supprimer.
- [x] Utiliser le selecteur natif pour les couleurs de categorie et sous-categorie, avec heritage explicite.
- [x] Conserver les actions accessibles, la modale partagee et les contrats fonctionnels.
- [ ] Valider le retest `10.5.330` en clair/sombre et 1440/390 px avant reouverture complete de Settings.

### Lot 4 - Trip / Partage

- [ ] Inventorier recap, historique, depense partagee, entree partagee, split montant, documents et liens budget.
- [x] Clarifier le formulaire depense/entree : champs specifiques visibles seulement dans le bon mode.
- [ ] Adapter toutes les modales au format mobile.
- [ ] Conserver les balances, remboursements, source externe/participant et option non due.
- [x] Ajouter test contrat Trip premium.
- [x] Passer les badges et panneaux d audit Trip sur le token danger, masquer les UUID et conserver des actions accessibles.
- [ ] Valider le retest audit Trip `10.5.332` en clair/sombre et 1440/390 px.

### Lot 5 - Patrimoine

Cautions est retire de l interface en `10.5.319` ; ses 5 lignes historiques soldees restent conservees cote donnees uniquement.

- [ ] Inventorier assets, amortissement, transactions liees, depenses annexes, documents, proprietaires et ventes.
- [x] Rendre visible inclusion/exclusion budget et cout amorti prorata possession.
- [x] Ameliorer recherche transaction/Trip par nom, montant, date et devise.
- [x] Conserver les liens documents et mouvements existants.
- [x] Ajouter test contrat Patrimoine premium.
- [x] Lire et traiter les trois retests `10.5.329` en `10.5.331`.
- [ ] Valider visuellement les trois retests descendants `10.5.331` en clair/sombre et 1440/390 px avant reouverture ; le module reste masque aux comptes standards pendant ce lot.

### Lot 6 - Sport

- [x] Inventorier programme, timer, grand ecran, chrono libre, historique, ajuster, progression et profil.
- [ ] Garder le timer actif, lisible et sans reset visuel en plein ecran.
- [ ] Rendre progression charges et analyse e1RM plus lisibles.
- [x] Garder sept cartes d historique detaillees puis compacter les anciennes sans perdre leurs actions.
- [ ] Verifier absence de veille/reprise bloquante si supportee.
- [x] Verifier historique clair/sombre en 1440/390 px sans debordement.
- [x] Ajouter test contrat Sport premium pour la densite de l historique.
- [ ] Faire executer le retest chargement/historique Sport `10.5.334`.
- [x] Remplacer les deux minuteurs concurrents par un selecteur Guide/Libre qui ne rend que le parcours actif.
- [ ] Faire executer le retest choix du minuteur Sport `10.5.335` en clair/sombre et 1440/390 px.
- [x] Retest saisie stable Alimentation `10.5.340` confirme OK et clos pour tous le 10/08/2026.
- [ ] Faire executer le retest evolution composition kg Sport `10.5.341` en clair/sombre et 1440/390 px, avec cinq series lisibles sans debordement.

### Lot 7 - Alimentation

- [ ] Inventorier timeline, recherche aliment, eau, alcool, objectifs, historique et sync locale.
- [ ] Rendre l'ajout plus reactif avec etats sync clairs.
- [ ] Conserver portions realistes, repas favoris et objectifs prise de masse.
- [ ] Verifier saisie mobile sans perte de focus.
- [ ] Ajouter test contrat Nutrition premium.

### Lot 8 - Travail

- [x] Inventorier missions, revenus, periodes, chomage, dossiers lies et fresque.
- [x] Clarifier heures nettes, montant gagne par devise, taux horaire et periodes de revenu.
- [x] Conserver et etendre la liaison dossiers aux missions, revenus et periodes.
- [ ] Ajouter visuel semaine/rythme sans surcharger.
- [x] Ajouter test contrat Travail premium et responsive.
- [ ] Valider les trois retests Travail `10.5.333` en clair/sombre et 1440/390 px.

### Lot 9 - Documents, Parametres, Notifications

- [ ] Inventorier Documents : dossiers, tags, preview, liens transactions/Trip/assets, partage et batch.
- [ ] Inventorier Parametres : voyage, periodes, categories, compte, notifications et suppression compte.
- [ ] Inventorier Notifications : modeles, variables, historique, file a envoyer.
- [ ] Appliquer les panneaux premium sans supprimer les fonctions avancees.
- [ ] Ajouter tests contrats dedies.

## Definition de termine

- [ ] Tests cibles du module OK.
- [ ] `npm test -- --run` OK si le module touche un parcours transverse.
- [ ] `npm run build` OK.
- [ ] `npm run perf:budget` OK ou budget ajuste et justifie.
- [ ] `npm run links:check` OK si `public/projet.html` change.
- [ ] APK generee et lien verifie quand une livraison mobile est faite.
- [ ] Git pousse sur `main`.
