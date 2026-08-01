# TravelBudget — règles graphiques officielles

Statut : **référence obligatoire** pour toute création ou modification d’interface.

Implémentation centrale : [`src/ui/premium-theme.css`](../src/ui/premium-theme.css).

## 1. Intention

TravelBudget est un carnet de bord financier premium : lumineux, solaire, précis et rassurant. Le voyage est évoqué par les repères, la progression et le mouvement, sans reprendre les codes décoratifs d’un blog touristique.

L’interface doit rester immédiatement opérationnelle. Une amélioration visuelle peut déplacer ou regrouper une commande, mais ne doit jamais supprimer une fonctionnalité utile existante.

## 2. Règles non négociables

1. Utiliser les tokens existants avant d’ajouter une nouvelle couleur, ombre ou valeur de rayon.
2. Conserver les identifiants, attributs `data-*`, gestionnaires et états des commandes existantes.
3. Une action principale maximum par zone visuelle.
4. Les données financières doivent rester lisibles avant toute décoration.
5. Toute interaction doit fonctionner au clavier, au clic et, lorsqu’elle implique un mouvement horizontal, au tactile.
6. Aucun débordement horizontal de page à 390 px de large.
7. Le thème sombre doit rester exploitable, même lorsqu’une première proposition cible le thème clair.
8. Une modification de dashboard doit préserver les wallets, budgets journaliers, KPI, projection et convertisseur.
9. Les contrôles avancés peuvent être regroupés ou déplacés, jamais masqués sans moyen évident de les retrouver.
10. Tout nouveau composant partagé doit recevoir une classe `tb-*` et éviter les styles inline lorsque la règle est réutilisable.

## 3. Palette et tokens

| Rôle | Token | Valeur de référence | Usage |
|---|---|---:|---|
| Toile | `--tb-canvas` | `#FFF9F2` | Fond général |
| Surface | `--tb-surface` | `#FFFFFF` | Cartes et panneaux |
| Surface douce | `--tb-surface-soft` | `#FFF1E3` | Barres d’actions et états légers |
| Texte principal | `--tb-ink` | `#20313A` | Titres, montants, actions |
| Texte secondaire | `--tb-muted` | `#687C86` | Métadonnées et explications |
| Action | `--tb-coral` | `#FF6B4A` | Bouton principal et point focal |
| Action forte | `--tb-coral-strong` | `#E94F32` | Survol et contraste |
| Équilibre | `--tb-lagoon` | `#23B5AF` | Progression positive et information |
| Succès | `--tb-success` | `#35A86B` | Valeur favorable |
| Vigilance | `--tb-warning` | `#F2B84B` | Alerte non bloquante |
| Danger | `--tb-danger` | `#E45151` | Suppression et dépassement |
| Bordure | `--tb-line` | `#F0DCCB` | Séparation douce |

Une carte ne doit pas employer plusieurs couleurs d’accent concurrentes. Les couleurs fonctionnelles accompagnent toujours un texte, une icône ou une forme : la couleur seule ne porte jamais le sens.

## 4. Typographie et chiffres

- Police principale : `Manrope`, puis les polices système définies dans le thème.
- Titres : compacts, légèrement resserrés et sans capitales intégrales.
- Libellés courts : capitales autorisées avec espacement léger.
- Montants : poids fort, devise visible, séparateurs locaux.
- Une carte KPI présente dans cet ordre : libellé, valeur, contexte.
- Éviter les paragraphes de plus de deux lignes dans le dashboard.

## 5. Formes, espacements et élévation

- Rayon contrôle : `--tb-radius-sm`, 12 px.
- Rayon carte : `--tb-radius-md`, 18 px.
- Rayon composition principale : `--tb-radius-lg`, 26 px.
- Espacements recommandés : 6, 8, 10, 12, 14, 18, 22 et 24 px.
- Ombre `--tb-shadow` uniquement pour distinguer les niveaux principaux.
- Une bordure douce est préférée à une accumulation d’ombres.

Le motif « point + ligne » introduit les sections majeures. Il ne doit pas être répété dans chaque sous-carte.

## 6. Boutons et commandes

### Hiérarchie

1. **Primaire** : fond corail, action dominante et immédiate.
2. **Secondaire** : corail clair, alternative proche.
3. **Tertiaire** : surface blanche, navigation ou utilitaire.
4. **Destructif** : rouge explicite, jamais utilisé comme action dominante par défaut.

### Conservation fonctionnelle

Avant de modifier un panneau, inventorier ses boutons, sélecteurs, cases à cocher et gestes. Après la modification, vérifier que chaque action possède toujours :

- son identifiant ou son attribut `data-*` d’origine ;
- son gestionnaire actif ;
- un libellé ou un nom accessible ;
- un emplacement cohérent avec l’objet concerné.

Exemple : `Archiver` reste dans la carte du wallet concerné. Les contrôles de projection restent dans le panneau de projection.

## 7. Navigation et iconographie

- Chaque module possède un emoji coloré stable et immédiatement identifiable.
- L’emoji repose sur un carré doux ; le module actif utilise un fond corail clair.
- Un même module conserve la même icône sur desktop et mobile.
- Les groupes officiels sont : Vue d’ensemble, Finances, Quotidien et Ressources.
- Les intitulés fonctionnels priment sur les intitulés créatifs.

## 8. Dashboard

Ordre de lecture recommandé :

1. Situation du jour et action principale.
2. KPI financiers et convertisseur.
3. Projection de trésorerie.
4. Wallets et budget journalier détaillé.
5. Alertes et éléments à surveiller.

Règles spécifiques :

- Le dashboard ne duplique pas une bannière d’appel vers Analyse.
- `Voir l’analyse` peut rester une action secondaire du résumé.
- La navigation du budget journalier conserve semaine précédente, aujourd’hui et semaine suivante.
- Le convertisseur est l’unique zone de permutation rapide des deux devises : bouton `↔` et swipe horizontal.
- Les KPI financiers obligatoires sont le total actuel des wallets, le total projeté en fin de période et le FX période/compte.
- Wallets, budget journalier, projection et convertisseur ne doivent pas être remplacés par des résumés simplifiés.

## 9. Cartes et panneaux

- Une carte porte un message principal.
- Les actions appartenant à une entité restent visuellement dans sa carte.
- Les détails secondaires se placent sous une séparation ou dans un élément progressif (`details`).
- Les états vides proposent une prochaine action concrète.
- Les listes financières conservent signe, montant, devise, statut et date.

## 10. Responsive et tactile

Points de contrôle obligatoires : 1440 px, 900 px, 600 px et 390 px.

- À 390 px, aucune largeur fixe ne doit provoquer de débordement de page.
- Les cibles tactiles visent au minimum 36 px, idéalement 40 px.
- Les barres d’actions se replient avant de réduire excessivement les libellés.
- Un geste horizontal ne doit pas bloquer le défilement vertical : utiliser `touch-action: pan-y` sur une zone de swipe localisée.
- Le swipe complète toujours un bouton visible ; il ne constitue jamais l’unique moyen d’action.

## 11. Thème sombre

- Réutiliser les variables globales existantes plutôt que dupliquer la palette claire.
- Conserver un contraste suffisant pour les montants, bordures et champs.
- Les états succès, vigilance et danger restent reconnaissables sans saturation excessive.
- Tester au minimum les barres d’actions, champs, cartes et graphiques.

## 12. À éviter

- Nouvelle couleur codée en dur sans rôle défini.
- Plusieurs boutons primaires dans la même zone.
- Carte décorative sans information ou action utile.
- Emoji différent pour un module déjà référencé.
- Contrôle déplacé hors de l’entité qu’il modifie.
- Suppression d’un bouton parce qu’il ne figure pas dans une maquette.
- Swipe sans bouton alternatif ni indication visuelle.
- Masquage des détails financiers importants pour alléger artificiellement la page.

## 13. Processus d’application module par module

1. Inventorier les données, commandes et états du module existant.
2. Associer chaque surface aux tokens officiels.
3. Appliquer la hiérarchie des cartes et des actions.
4. Conserver les contrats fonctionnels et attributs de liaison.
5. Vérifier thèmes clair et sombre.
6. Vérifier desktop et mobile.
7. Ajouter ou mettre à jour les tests de contrat.
8. Exécuter la checklist ci-dessous.

## 14. Checklist avant validation

- [ ] Les tokens officiels sont utilisés.
- [ ] Tous les boutons et contrôles utiles sont conservés.
- [ ] Une seule action principale existe par zone.
- [ ] Les montants et devises sont immédiatement lisibles.
- [ ] Le rendu ne déborde pas à 390 px.
- [ ] Les gestes tactiles possèdent une alternative visible.
- [ ] Le thème sombre reste lisible.
- [ ] Les états vide, chargement, erreur et données réelles sont cohérents.
- [ ] Les tests ciblés réussissent.
- [ ] `npm run build` réussit.
- [ ] `git diff --check` ne remonte aucune erreur.

## 15. Vérification locale

```powershell
npm test -- --run tests/ui/visualSystemContract.test.js
npm test -- --run tests/features/dashboard tests/features/kpi tests/ui/dashboardViewContract.test.js
npm run build
git diff --check
```

Toute exception à cette charte doit être documentée dans la modification concernée avec sa raison fonctionnelle.
