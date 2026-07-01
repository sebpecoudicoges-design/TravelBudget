# V11 - composants UI partages

## Socle

- `src/ui/components.js` expose `createModal()` et `stateMessage()` via `window.UI`.
- `src/ui/shared.css` porte la structure responsive, les dimensions stables et les etats visuels.
- Le contenu metier reste dans chaque module ; le composant gere le cadre, l'accessibilite, la fermeture et le responsive.

## Premier composant migre

La fenetre Sport `Ajuster la seance` utilise la modale partagee :

- panneau centre sur desktop et feuille basse sur mobile ;
- en-tete et actions fixes, contenu interne scrollable ;
- lignes de series adaptatives sans debordement horizontal ;
- titre de dialogue et bouton Fermer accessibles ;
- suppression et sauvegarde conservees dans le module Sport.

## Regle de migration

Une fenetre est migree seulement quand son parcours principal peut etre teste. Les prochaines candidates sont les editeurs de seance parametree, Patrimoine puis Trip. Les boutons, champs et etats seront extraits au fil de ces migrations pour eviter une couche abstraite sans usage reel.

