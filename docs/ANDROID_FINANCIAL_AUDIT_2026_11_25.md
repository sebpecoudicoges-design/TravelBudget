# Android et parcours financiers : contrôle sur la branche d’audit

La dernière version Android publiquement distribuée reste `10.5.395`, package historique `com.travelbudget.app`. Le fichier public a été téléchargé à nouveau et son empreinte correspond à la preuve de livraison ; il contient le manifeste, la page d’entrée, le service worker et la configuration Capacitor attendus. L’APK privé compilé ailleurs ne remplace pas cette distribution, et le package Play Store de diffusion est différent. Aucun déploiement, APK publié ni brouillon Play Console n’est modifié.

Le workflow `Published Android APK smoke` établit une preuve séparée en émulateur : signature des deux APK distribués, mise à jour sans désinstallation depuis `10.5.394`, lancement Android hors ligne, association du retour OAuth au bon écran et permission de notification déclarée. Il ne constitue pas un essai Google connecté, un test de réception de notification, de document, ni une preuve sur le Galaxy physique.

## Parcours synthétique Wallet → Trip → Budget → Analyse

- Solde de départ : 500 EUR. Paiement partagé : 120 EUR débité immédiatement. Quote-part personnelle : 45 EUR. Créance sur l’autre participant : 75 EUR. Avoir marchand : 15 EUR.
- Le wallet termine à 395 EUR (500 − 120 + 15), sans second débit de 45 EUR. La consommation budgétaire nette est de 30 EUR répartis sur trois jours, soit 10 EUR/j.
- Le modèle du tableau de bord ne classe plus une quote-part personnelle dans la trésorerie prévisionnelle du seul fait que son libellé contient « Avance ».
- Le détail de trésorerie d’Analyse utilise la date d’opération réelle, même si les jours budgétaires visibles sont différents. La ventilation budgétaire garde ses propres dates.
- Reste une décision fonctionnelle sur l’indicateur « Budget dépensé/jour » du tableau de bord : il affiche la dépense personnelle brute de 15 EUR/j, contre 10 EUR/j net dans Budget et Analyse après l’avoir. Ne pas présenter ces montants comme équivalents avant choix du produit.
- Validation : modèles client réels avec données fictives, sans compte de production. Restent les manipulations de l’interface sur l’appareil, le basculement de réseau et les autres parcours métier.

## Contrôle physique minimal

Avant toute mise à jour, relever la version installée et le package. Ne pas désinstaller l’application pour résoudre une incompatibilité de signature. Vérifier ensuite démarrage et retour Google (sans fermer une session contenant des actions non synchronisées), ouverture d’un document de test, état des notifications et réseau faible/reconnexion. Les essais d’écriture nécessitent un compte fictif ou un environnement isolé ; utiliser les données réelles uniquement en lecture si leur propriétaire l’autorise.

## Contrôle du parcours dans le navigateur

`npm run test:e2e -- tests/e2e/financial-trip-budget.spec.js --project=desktop-chromium`
ouvre la vraie application en 1440 et 390 px, en clair et sombre, avec un compte de test fictif.
Le parcours vérifie le solde du compte (395 EUR), la part personnelle (45 EUR) et
le montant à recevoir (75 EUR) dans Trip, les trois jours de budget à 10 EUR nets,
ainsi que le total de 30 EUR et l'avoir de 15 EUR dans Analyse.
Il contrôle aussi que la sortie de 120 EUR apparaît selon sa date réelle, pas selon
les dates de ventilation. Les réponses du serveur sont simulées ; ce scénario
ne valide ni la saisie et sa persistance serveur, ni le WebView Android natif.

### Règlement Trip dans une autre devise

Le montant du règlement reste exprimé dans la devise de la dette. La transaction
de compte conserve son montant et sa devise propres. Quand elles diffèrent, la
fenêtre demande les deux montants séparément ; en devise identique, le montant
saisi reste commun, y compris pour un règlement partiel.

Le scénario navigateur simule un reçu en AUD qui règle une partie d’une dette
en EUR, une réponse perdue, un nouvel essai avec le même identifiant, une
actualisation puis l’annulation depuis Trip. Le serveur est simulé pour ce
test d’interface. En complément, `node scripts/test-trip-settlement-postgres.mjs /chemin/vers/pglite/dist/index.js`
rejoue les fonctions SQL réelles dans PostgreSQL en mémoire (PGlite 0.3.15,
schéma de test minimal) et vérifie qu’un seul mouvement est créé et que deux
annulations préservent une transaction indépendante. Aucun projet connecté
n’est utilisé par ces scénarios.
