# Mesure du démarrage connecté — 25 octobre 2026

La commande `npm run perf:startup` complète la mesure anonyme par un démarrage avec session synthétique restaurée. Chaque parcours utilise un contexte Chromium neuf, sans cache ni service worker, sur la compilation `dist`. Le profil mobile mesure une largeur de 390 px, un CPU ralenti ×4 et les ressources locales avec 40 ms de latence et 10 Mbit/s en réception. Le desktop utilise 1440 px.

Le vrai client Supabase, les chargeurs, le bootstrap, les calculs et ApexCharts sont exécutés. Seules les réponses HTTP et la session sont synthétiques : un utilisateur testeur, un voyage, une période de 92 jours, un wallet EUR de 10 000 et 1 200 dépenses EUR de 1, payées sur les 23 premiers jours d’octobre 2026. La lecture des transactions traverse deux pages. Sport, Travail et Nutrition sont vides. La date civile est décalée au 24 octobre 2026, avec horloge, temporisateurs et marqueurs de performance qui continuent à avancer.

Le transport n’autorise que les fichiers locaux et les réponses explicitement définies dans `scripts/fixtures/connectedStartup.mjs`. Aucun appel n’est transmis au projet Supabase ; les requêtes non configurées et les WebSockets sont bloqués et font échouer le contrôle. Les écritures REST ne sont pas autorisées. Ce jeu limité ne constitue pas un émulateur PostgREST général : seules les opérations utilisées par ce scénario sont représentées.

## Point de mesure et seuils

L’état prêt connecté exige la fin du bootstrap, le bon utilisateur, le Dashboard actif, les 1 200 identifiants de transaction distincts, un wallet, les données KPI chargées, la courbe rendue et l’écran de connexion masqué. Son instant est mesuré par un marqueur natif de performance, au premier contrôle qui constate cet état. Une fenêtre supplémentaire de 1,5 s observe les imports différés ; le temps cumulé d’exécution JS inclut cette fenêtre. Il ne s’agit pas d’un TTI ni d’une mesure isolée du parsing.

- Les deux parcours bloquent sur une erreur JS, un script absent ou distant, des temps non renseignés et plus de 60 scripts.
- L’anonyme conserve le plafond de 1 500 KiB JS et interdit les moteurs graphiques.
- Le connecté dispose d’un plafond de 2 450 KiB JS et de 40 appels API synthétiques ; ECharts reste interdit au démarrage du Dashboard.
- Les durées sont enregistrées sans seuil dépendant de la puissance de la machine. Le délai maximal d’attente sert seulement à détecter un démarrage incomplet.

Le JSON sépare `localTransferredKiB` (octets CDP des ressources de la même origine, compression comprise) de `fixtureResponseKiB` (taille JSON cumulée des réponses synthétiques). Ces dernières ne sont pas un transfert réseau réel et leur latence serveur n’est pas simulée. Le précédent champ global `transferredKiB` est remplacé pour éviter cette confusion.

Premier essai complet : connecté à 47 scripts et 2 353,6 KiB JS, contre 44 et 1 374,4 KiB en anonyme ; 21 appels API synthétiques. Dashboard prêt vers 1,45 s desktop / 10,16 s mobile simulé ; exécution JS cumulée environ 0,77 s / 7,19 s. Ces temps varient avec la machine. Le volume et le coût de rendu avec un historique rempli justifient de poursuivre le profilage des calculs et rendus, sans attribuer leur coût à un module précis avant mesure.

## Portée de cette livraison

Huit tests vérifient la pagination, les identifiants distincts, les filtres de compte, la projection des colonnes et le rejet des requêtes non prévues. Le parcours lui-même est exécuté par la CI et son JSON conservé dans `startup-report`. Le code de l’application et l’APK 10.5.380 ne sont pas modifiés par ce lot d’outillage ; la page Projet et l’Atlas web sont actualisés séparément.

La recherche de code mort sur le script a conduit au remplacement de la mesure globale ambiguë et à la correction de l’argument de délai de `waitForFunction`. Le serveur de mesure se ferme aussi si Chromium ne démarre pas. Aucun chargeur applicatif supprimé. Les essais sur compte réel, SQL/RLS, téléphone, autres navigateurs et avec davantage de domaines restent distincts. F9 progresse, sans clôturer l’ensemble de la phase architecture/qualité.
