# TravelBudget 10.5.396, correctif web 1

Lot prélevé sur la branche d’audit : file hors ligne Trip, protection et reprise du
sommeil, calculs Budget/Analyse, cohérence entre les dates de budget et de trésorerie,
et remboursements Trip multidevises. Les corrections et tests sont transférés sans
intégrer la branche d’audit en bloc.

Non inclus : F13, migrations SQL, changements Supabase Edge (y compris l’aide
comptable côté serveur), Play Store ni tests sur téléphone réel. Le lien public
Android existant continue de pointer vers l’APK officiel 10.5.395. Un APK de test
créé sur un runner, signé avec sa propre clé de débogage, ne remplace pas la
signature Android déjà distribuée : ne pas désinstaller l’APK existant.

Numéro web inchangé : la page publique de projet n’est pas modifiée. Le cache web
porte un identifiant distinct pour que le nouveau lot remplace l’ancienne version.
