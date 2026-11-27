# Android et parcours financiers : contrôle sur la branche d’audit

La dernière version Android publiquement distribuée reste `10.5.395`, package historique `com.travelbudget.app`. Le fichier public a été téléchargé à nouveau et son empreinte correspond à la preuve de livraison ; il contient le manifeste, la page d’entrée, le service worker et la configuration Capacitor attendus. L’APK privé compilé ailleurs ne remplace pas cette distribution, et le package Play Store de diffusion est différent. Aucun déploiement, APK publié ni brouillon Play Console n’est modifié.

Le workflow `Published Android APK smoke` établit une preuve séparée en émulateur : signature des deux APK distribués, mise à jour sans désinstallation depuis `10.5.394`, lancement Android hors ligne, association du retour OAuth au bon écran et permission de notification déclarée. Il ne constitue pas un essai Google connecté, un test de réception de notification, de document, ni une preuve sur le Galaxy physique.

## Parcours synthétique Wallet → Trip → Budget → Analyse

- Solde de départ : 500 EUR. Paiement partagé : 120 EUR débité immédiatement. Quote-part personnelle : 45 EUR. Créance sur l’autre participant : 75 EUR. Avoir marchand : 15 EUR.
- Le wallet termine à 395 EUR (500 − 120 + 15), sans second débit de 45 EUR. La consommation budgétaire nette est de 30 EUR répartis sur trois jours, soit 10 EUR/j.
- Le modèle du tableau de bord ne classe plus une quote-part personnelle dans la trésorerie prévisionnelle du seul fait que son libellé contient « Avance ».
- Le détail de trésorerie d’Analyse utilise la date d’opération réelle, même si les jours budgétaires visibles sont différents. La ventilation budgétaire garde ses propres dates.
- La légende « Dépenses avant avoirs/jour » du tableau de bord indique que sa série affiche 15 EUR/j bruts, contre 10 EUR/j nets dans Budget et Analyse après l’avoir. La légende seule change ; remplacer cette série par une série nette reste un choix produit.
- Validation : modèles client réels avec données fictives, sans compte de production. Restent les manipulations de l’interface sur l’appareil, le basculement de réseau et les autres parcours métier.

## Contrôle physique minimal

Avant toute mise à jour, relever la version installée et le package. Ne pas désinstaller l’application pour résoudre une incompatibilité de signature. Vérifier ensuite démarrage et retour Google (sans fermer une session contenant des actions non synchronisées), ouverture d’un document de test, état des notifications et réseau faible/reconnexion. Les essais d’écriture nécessitent un compte fictif ou un environnement isolé ; utiliser les données réelles uniquement en lecture si leur propriétaire l’autorise.

## Contrôle du parcours dans le navigateur

`npm run test:e2e -- tests/e2e/financial-trip-budget.spec.js --project=desktop-chromium`
ouvre la vraie application en 1440 et 390 px, en clair et sombre, avec un compte de test fictif.
Le parcours vérifie le solde du compte (395 EUR), la légende et les 15 EUR/j bruts du tableau de bord, la part personnelle (45 EUR) et
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

### Réintégration d’une dépense Wallet (F3)

Un parcours navigateur fictif, à 1 440 px en clair et 390 px en sombre, édite une
dépense payée de 24 EUR depuis Transactions : hors budget, réintégrée, puis à
nouveau hors budget. Le budget passe de 10 à 18 puis à 10 EUR nets par jour
sur les 21–23 octobre, et Analyse de 30 à 54 puis à 30 EUR. Le solde Wallet
reste à 371 EUR. Les sorties payées de 144 EUR (dépense de 24 + avance
Trip de 120) restent datées du 20 octobre, pas des jours budgétaires. La
ligne d’avance Trip reste accessible depuis Trip et non éditable depuis le
même formulaire. Le test vérifie que seul l’identifiant de la dépense Wallet
est envoyé, avec les deux jeux de dates préservés. Il simule la réponse
du serveur ; ce contrôle est complémentaire de la preuve SQL historique
et ne valide ni les RPC du projet connecté ni un appareil réel.


### F6 : reprise d’une séance Sport après changement de voyage

Une nouvelle séance locale enregistre le voyage au moment de la sauvegarde.
La tentative initiale et les reprises réutilisent cette valeur ; une absence
explicite de voyage reste une absence. Les anciennes entrées dépourvues de
ce champ gardent le repli précédent, sans migration.

Sur données fictives, le navigateur s’appuie sur l’historique local et le
vrai client Sport : une réponse perdue laisse la séance non confirmée ;
après rechargement avec un autre voyage actif, la reprise renvoie le même
identifiant, le voyage d’origine, le même exercice et ses deux séries
(8 et 6 répétitions), puis marque la séance confirmée. Une nouvelle
demande n’envoie plus de sauvegarde. Le serveur de test est simulé ;
les contraintes de PostgreSQL ou l’état d’un appareil Android ne sont
pas prouvés par ce parcours.
