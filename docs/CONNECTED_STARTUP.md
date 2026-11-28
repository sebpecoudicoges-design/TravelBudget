# Mesure du démarrage connecté — 25 octobre 2026

Suite 10.5.382 : [file unique de rendu de la courbe et correction des filtres rapides](CASHFLOW_QUEUE_10_5_382.md).

Suite : [profilage et optimisation de la courbe en 10.5.381](CASHFLOW_CPU_10_5_381.md). L'option `TB_CPU_PROFILE=1` enregistre les profils CPU Chromium ; elle reste désactivée pour les comparaisons temporelles ordinaires.

La commande `npm run perf:startup` complète la mesure anonyme par un démarrage avec session synthétique restaurée et un passage par le formulaire avec Auth simulé. Chaque parcours utilise un contexte Chromium neuf, sans cache ni service worker, sur la compilation `dist`. Le profil mobile mesure une largeur de 390 px, un CPU ralenti ×4 et les ressources locales avec 40 ms de latence et 10 Mbit/s en réception. Le desktop utilise 1440 px.

Le vrai client Supabase, les chargeurs, le bootstrap, les calculs et ApexCharts sont exécutés. Seules les réponses HTTP et la session sont synthétiques : un utilisateur testeur, un voyage, une période de 92 jours, un wallet EUR de 10 000 et 1 200 dépenses EUR de 1, payées sur les 23 premiers jours d’octobre 2026. La lecture des transactions traverse deux pages. Sport, Travail et Nutrition sont vides. La date civile est décalée au 24 octobre 2026, avec horloge, temporisateurs et marqueurs de performance qui continuent à avancer.

Le transport n’autorise que les fichiers locaux et les réponses explicitement définies dans `scripts/fixtures/connectedStartup.mjs`. Aucun appel n’est transmis au projet Supabase ; les requêtes non configurées et les WebSockets sont bloqués et font échouer le contrôle. Les écritures REST ne sont pas autorisées. Ce jeu limité ne constitue pas un émulateur PostgREST général : seules les opérations utilisées par ce scénario sont représentées.

## Point de mesure et seuils

L’état prêt connecté exige la fin du bootstrap, le bon utilisateur, le Dashboard actif, les 1 200 identifiants de transaction distincts, un wallet, les données KPI chargées, la courbe rendue et l’écran de connexion masqué. Son instant est mesuré par un marqueur natif de performance, au premier contrôle qui constate cet état. Une fenêtre supplémentaire de 1,5 s observe les imports différés ; le temps cumulé d’exécution JS inclut cette fenêtre. Il ne s’agit pas d’un TTI ni d’une mesure isolée du parsing.

- Les trois parcours bloquent sur une erreur JS, un script absent ou distant, des temps non renseignés et plus de 60 scripts.
- L’anonyme conserve le plafond de 1 500 KiB JS et interdit les moteurs graphiques.
- Le connecté dispose d’un plafond de 2 450 KiB JS et de 40 appels API synthétiques ; ECharts reste interdit au démarrage du Dashboard.
- Les durées sont enregistrées sans seuil dépendant de la puissance de la machine. Le délai maximal d’attente sert seulement à détecter un démarrage incomplet.

Le JSON sépare `localTransferredKiB` (octets CDP des ressources de la même origine, compression comprise) de `fixtureResponseKiB` (taille JSON cumulée des réponses synthétiques). Ces dernières ne sont pas un transfert réseau réel et leur latence serveur n’est pas simulée. Le précédent champ global `transferredKiB` est remplacé pour éviter cette confusion.

Premier essai complet : connecté à 47 scripts et 2 353,6 KiB JS, contre 44 et 1 374,4 KiB en anonyme ; 21 appels API synthétiques. Dashboard prêt vers 1,45 s desktop / 10,16 s mobile simulé ; exécution JS cumulée environ 0,77 s / 7,19 s. Ces temps varient avec la machine. Le volume et le coût de rendu avec un historique rempli justifient de poursuivre le profilage des calculs et rendus, sans attribuer leur coût à un module précis avant mesure.

## Portée de cette livraison

Huit tests vérifient la pagination, les identifiants distincts, les filtres de compte, la projection des colonnes et le rejet des requêtes non prévues. Le parcours lui-même est exécuté par la CI et son JSON conservé dans `startup-report`. Le code de l’application et l’APK 10.5.380 ne sont pas modifiés par ce lot d’outillage ; la page Projet et l’Atlas web sont actualisés séparément.

La recherche de code mort sur le script a conduit au remplacement de la mesure globale ambiguë et à la correction de l’argument de délai de `waitForFunction`. Le serveur de mesure se ferme aussi si Chromium ne démarre pas. Aucun chargeur applicatif supprimé. Les essais sur compte réel, SQL/RLS, téléphone, autres navigateurs et avec davantage de domaines restent distincts. F9 progresse, sans clôturer l’ensemble de la phase architecture/qualité.


## Profil tactile et tâches longues (F9)

Le profil à 390 px utilise également un contexte Chromium mobile à écran tactile (DPR 2) ; le profil 1440 px conserve un contexte ordinateur. Le rapport vérifie le mode d’entrée et enregistre, si Chromium les expose, le nombre, le cumul et la durée maximale des tâches longues observées au démarrage. Ces durées sont informatives, pas des seuils CI, et dépendent du runner. Les seuils déterministes de requêtes et de volume restent identiques. Le workflow de la branche d’audit rejoue les six démarrages de la compilation. La simulation ne mesure ni la mémoire Vitals, ni les performances d’un appareil Android, ni celles d’un compte réel.

**Vérification F9 du parcours anonyme.** Le banc ouvre maintenant la route normale, sans le paramètre `freeze`, dans les deux profils anonymes. Aucun compte n’est injecté et toutes les requêtes hors serveur local sont interceptées ou bloquées. Le nouveau repère `anonymousReadyMs` est observé lorsque le bootstrap est terminé et le champ email visible et activé ; Playwright vérifie séparément que le champ peut recevoir un clic, sans cliquer, saisir ou soumettre une connexion. Le repère `legacyReadyMs` reste comparable ; la nouvelle mesure n’est ni un seuil de latence ni une mesure Android réelle. Les deux profils connectés fictifs et les plafonds restent inchangés.

**Diagnostic F9 en cas d’arrêt du démarrage.** Si la navigation ou une condition de disponibilité échoue, le JSON conserve maintenant le profil en échec, l’étape (chargement, bootstrap, formulaire anonyme, formulaire cliquable ou tableau de bord fictif), les ressources observées et un état sommaire sans identifiant ni valeur de formulaire. Le programme reste en échec et n’essaye pas les profils suivants. Pour vérifier le diagnostic sans toucher au produit, utiliser une copie temporaire de `dist`, masquer le champ email dans l’index de cette copie, puis exécuter le script avec celle-ci comme dossier de travail : le rapport doit contenir le profil anonyme desktop, `failure.stage = anonymous-ready` et `state.emailVisible = false`.

### Connexion depuis le formulaire (F9)

Le parcours `signin-fixture` part d’un contexte neuf sans jeton préchargé. Il attend l’écran anonyme, remplit les champs avec des valeurs strictement fictives et clique sur le vrai bouton de connexion. Le client Auth effectue une seule demande de session ; seule cette demande légitime de la fixture reçoit la réponse simulée. Le tableau de bord doit ensuite satisfaire les mêmes critères et plafonds que le parcours avec session restaurée. Le rapport ajoute `signinToDashboardMs`, du vrai événement de soumission jusqu’au tableau de bord prêt. Ce temps comprend le chargement et l’affichage locaux, pas la latence d’un fournisseur d’identité réel. Aucun identifiant de session ou corps du formulaire n’est enregistré dans le rapport. Ni Google OAuth ni l’application Android native ne sont testés ici.
