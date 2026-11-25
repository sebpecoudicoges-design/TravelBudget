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
