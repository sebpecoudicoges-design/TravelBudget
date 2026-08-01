-- Module-by-module validation campaign for admin and test accounts.

create table if not exists public.app_test_campaigns (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  app_version text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'completed', 'archived')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_test_modules (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.app_test_campaigns(id) on delete cascade,
  module_key text not null,
  title text not null,
  description text,
  instructions text,
  sort_order integer not null default 0,
  status text not null default 'queued' check (status in ('queued', 'in_test', 'fixing', 'validated', 'open')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, module_key),
  unique (id, campaign_id)
);

create table if not exists public.app_test_scenarios (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.app_test_campaigns(id) on delete cascade,
  module_id uuid not null,
  title text not null,
  instructions text not null,
  expected_result text not null,
  required boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  foreign key (module_id, campaign_id) references public.app_test_modules(id, campaign_id) on delete cascade,
  unique (id, campaign_id),
  unique (module_id, sort_order)
);

create table if not exists public.app_test_results (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.app_test_campaigns(id) on delete cascade,
  scenario_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'ok', 'not_ok')),
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (scenario_id, campaign_id) references public.app_test_scenarios(id, campaign_id) on delete cascade,
  unique (scenario_id, user_id)
);

create table if not exists public.app_test_module_reviews (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.app_test_campaigns(id) on delete cascade,
  module_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed_ok', 'completed_with_issues')),
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (module_id, campaign_id) references public.app_test_modules(id, campaign_id) on delete cascade,
  unique (module_id, user_id)
);

create index if not exists app_test_modules_campaign_sort_idx on public.app_test_modules(campaign_id, sort_order);
create index if not exists app_test_scenarios_campaign_module_idx on public.app_test_scenarios(campaign_id, module_id, sort_order);
create index if not exists app_test_results_user_campaign_idx on public.app_test_results(user_id, campaign_id);
create index if not exists app_test_module_reviews_user_campaign_idx on public.app_test_module_reviews(user_id, campaign_id);

alter table public.app_test_campaigns enable row level security;
alter table public.app_test_modules enable row level security;
alter table public.app_test_scenarios enable row level security;
alter table public.app_test_results enable row level security;
alter table public.app_test_module_reviews enable row level security;

revoke all on public.app_test_campaigns, public.app_test_modules, public.app_test_scenarios, public.app_test_results, public.app_test_module_reviews from authenticated;
grant select on public.app_test_campaigns, public.app_test_modules, public.app_test_scenarios to authenticated;
grant select, insert, update on public.app_test_results, public.app_test_module_reviews to authenticated;
grant all on public.app_test_campaigns, public.app_test_modules, public.app_test_scenarios, public.app_test_results, public.app_test_module_reviews to service_role;

create policy app_test_campaigns_privileged_read on public.app_test_campaigns
for select to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id = (select auth.uid()) and lower(p.role) in ('admin', 'test')
));

create policy app_test_modules_privileged_read on public.app_test_modules
for select to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id = (select auth.uid()) and lower(p.role) in ('admin', 'test')
));

create policy app_test_scenarios_privileged_read on public.app_test_scenarios
for select to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id = (select auth.uid()) and lower(p.role) in ('admin', 'test')
));

create policy app_test_results_read on public.app_test_results
for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and lower(p.role) = 'admin'
  )
);

create policy app_test_results_insert_own on public.app_test_results
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and lower(p.role) in ('admin', 'test')
  )
);

create policy app_test_results_update_own on public.app_test_results
for update to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and lower(p.role) in ('admin', 'test')
  )
);

create policy app_test_module_reviews_read on public.app_test_module_reviews
for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and lower(p.role) = 'admin'
  )
);

create policy app_test_module_reviews_insert_own on public.app_test_module_reviews
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and lower(p.role) in ('admin', 'test')
  )
);

create policy app_test_module_reviews_update_own on public.app_test_module_reviews
for update to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and lower(p.role) in ('admin', 'test')
  )
);

-- A browser user may edit contact fields but can never promote their own role.
revoke insert, update on public.profiles from authenticated;
grant insert (id, email, whatsapp_phone_e164) on public.profiles to authenticated;
grant update (email, whatsapp_phone_e164) on public.profiles to authenticated;

insert into public.app_test_campaigns (id, slug, title, description, app_version, status, starts_at)
values (
  '20000000-0000-4000-8000-000000000001',
  'stabilisation-modules-10-5-316',
  'Stabilisation module par module',
  'Teste chaque parcours reel, indique OK ou Pas OK et note precisement les ecarts. Dashboard est le premier module a valider.',
  '10.5.316',
  'active',
  now()
)
on conflict (slug) do update set
  title = excluded.title,
  description = excluded.description,
  app_version = excluded.app_version,
  status = excluded.status,
  updated_at = now();

with seed as (
  select * from jsonb_to_recordset($modules$[
    {"module_key":"dashboard","title":"Dashboard","description":"Situation du jour, wallets, budget journalier, KPI, projection et FX.","instructions":"Teste sur donnees reelles, puis en clair et sombre, desktop et mobile.","sort_order":1,"status":"in_test"},
    {"module_key":"transactions","title":"Transactions","description":"Liste, filtres et mutations des transactions.","instructions":"Utilise une transaction de test identifiable et nettoie-la en fin de parcours.","sort_order":2,"status":"queued"},
    {"module_key":"settings","title":"Settings","description":"Compte, voyages, periodes, categories et preferences.","instructions":"Evite de supprimer les seules donnees de reference du compte.","sort_order":3,"status":"queued"},
    {"module_key":"analysis","title":"Analyse","description":"Filtres, graphiques, projections et detail des depenses.","instructions":"Compare les montants avec Dashboard et Transactions.","sort_order":4,"status":"queued"},
    {"module_key":"trip","title":"Trip / Partage","description":"Depenses partagees, participants, reglements et documents.","instructions":"Utilise un voyage de test et verifie les liens budget.","sort_order":5,"status":"queued"},
    {"module_key":"sport","title":"Sport","description":"Programme, timer, historique, profil et mesures.","instructions":"Teste une seance courte identifiable puis son historique.","sort_order":6,"status":"queued"},
    {"module_key":"nutrition","title":"Alimentation","description":"Repas, eau, objectifs, sommeil et synchronisation.","instructions":"Utilise la date du jour et verifie les KPI apres sauvegarde.","sort_order":7,"status":"queued"},
    {"module_key":"work","title":"Travail","description":"Missions, periodes, revenus et activite physique.","instructions":"Cree des donnees de test reconnaissables et controle leur persistance.","sort_order":8,"status":"queued"},
    {"module_key":"assets","title":"Patrimoine","description":"Actifs, proprietaires, amortissement, transactions et documents.","instructions":"Controle les effets budget avant toute suppression.","sort_order":9,"status":"queued"},
    {"module_key":"cautions","title":"Cautions","description":"Depots, statuts et mouvements associes.","instructions":"Teste creation, modification et restitution sur une caution de test.","sort_order":10,"status":"queued"},
    {"module_key":"documents","title":"Documents","description":"Dossiers, recherche, apercu et liens metier.","instructions":"Utilise un fichier sans donnee sensible pour le test.","sort_order":11,"status":"queued"},
    {"module_key":"inbox","title":"A traiter","description":"Demandes, documents et actions en attente.","instructions":"Teste les filtres et l ouverture des objets sources.","sort_order":12,"status":"queued"},
    {"module_key":"notifications","title":"Notifications","description":"Centre de notifications et navigation cible.","instructions":"Teste lecture, compteur et ouverture de la destination.","sort_order":13,"status":"queued"},
    {"module_key":"help","title":"Aide","description":"Recherche, FAQ et acces aux informations utiles.","instructions":"Teste plusieurs mots cles en francais et en anglais.","sort_order":14,"status":"queued"}
  ]$modules$::jsonb) as x(module_key text,title text,description text,instructions text,sort_order int,status text)
)
insert into public.app_test_modules (id, campaign_id, module_key, title, description, instructions, sort_order, status)
select md5('20000000-0000-4000-8000-000000000001' || module_key)::uuid,
       '20000000-0000-4000-8000-000000000001', module_key, title, description, instructions, sort_order, status
from seed
on conflict (campaign_id, module_key) do update set
  title = excluded.title,
  description = excluded.description,
  instructions = excluded.instructions,
  sort_order = excluded.sort_order,
  status = excluded.status,
  updated_at = now();

with seed as (
  select * from jsonb_to_recordset($scenarios$[
    {"module_key":"dashboard","sort_order":1,"title":"Chargement et situation du jour","instructions":"Ouvre Dashboard apres une connexion fraiche puis change de module et reviens.","expected_result":"Le Dashboard apparait sans rechargement manuel, sans ecran vide ni erreur console."},
    {"module_key":"dashboard","sort_order":2,"title":"Wallet complet","instructions":"Cree un wallet AUD de test, renomme-le, change son type, archive-le puis restaure-le.","expected_result":"Chaque action persiste et le wallet reste dans sa propre carte avec ses commandes."},
    {"module_key":"dashboard","sort_order":3,"title":"Gardes wallet","instructions":"Tente un nom vide puis la suppression d un wallet contenant une transaction.","expected_result":"Les deux actions invalides sont refusees proprement sans fermer brutalement la modale."},
    {"module_key":"dashboard","sort_order":4,"title":"Budget journalier et navigation","instructions":"Parcours semaine precedente, aujourd hui et semaine suivante et compare une depense connue.","expected_result":"Dates, montants et repartitions restent coherents, sans double comptage Trip."},
    {"module_key":"dashboard","sort_order":5,"title":"KPI, projection et FX","instructions":"Controle total wallets, fin de periode, projection et convertis 10 unites puis inverse les devises.","expected_result":"Les montants sont coherents et le convertisseur fonctionne dans les deux sens."},
    {"module_key":"dashboard","sort_order":6,"title":"Clair, sombre et mobile","instructions":"Refais une lecture en theme clair, sombre, largeur 1440 px puis 390 px.","expected_result":"Aucun debordement horizontal, toutes les actions restent lisibles et tactiles."},

    {"module_key":"transactions","sort_order":1,"title":"Filtres combines","instructions":"Utilise recherche, wallet, categorie, dates et statut de paiement.","expected_result":"La liste se met a jour sans perdre les filtres ni deborder sur mobile."},
    {"module_key":"transactions","sort_order":2,"title":"Cycle de vie transaction","instructions":"Cree, modifie, duplique puis supprime une transaction de test.","expected_result":"Les montants, dates, categorie et wallet persistent a chaque etape."},
    {"module_key":"transactions","sort_order":3,"title":"Transactions protegees","instructions":"Tente de modifier une transaction liee a Trip ou a un transfert interne.","expected_result":"L action est bloquee avec une explication et le module source est identifiable."},

    {"module_key":"settings","sort_order":1,"title":"Compte et preferences","instructions":"Verifie email, langue, theme, devise de base et preferences de notification.","expected_result":"Les preferences persistent apres rafraichissement et le compte reste accessible."},
    {"module_key":"settings","sort_order":2,"title":"Voyages et periodes","instructions":"Selectionne un voyage, rafraichis, puis cree et annule une periode de test.","expected_result":"Le voyage selectionne reste actif et les modales se ferment sans erreur."},
    {"module_key":"settings","sort_order":3,"title":"Categories","instructions":"Cree, renomme, reordonne et desactive une categorie ou sous-categorie de test.","expected_result":"Ordre, nom, couleur, statut et mapping persistent sans doublon."},

    {"module_key":"analysis","sort_order":1,"title":"Chargement Analyse","instructions":"Depuis Dashboard, ouvre Analyse avec un voyage contenant des transactions.","expected_result":"Les donnees et FX Decision apparaissent sans rester sur Chargement analyse."},
    {"module_key":"analysis","sort_order":2,"title":"Filtres et drilldown","instructions":"Change periode, categorie et sous-categorie puis ouvre le detail d une barre.","expected_result":"Graphiques, resume et liste detaillee utilisent le meme perimetre."},
    {"module_key":"analysis","sort_order":3,"title":"Coherence financiere","instructions":"Compare total depense et projection avec Dashboard et Transactions.","expected_result":"Les ecarts eventuels sont explicables par les filtres et aucun double comptage apparait."},

    {"module_key":"trip","sort_order":1,"title":"Depense partagee","instructions":"Cree une depense avec plusieurs participants et un split Montant.","expected_result":"Les parts totalisent le montant et la fenetre reste utilisable a 390 px."},
    {"module_key":"trip","sort_order":2,"title":"Matching et reglement","instructions":"Teste le rapprochement transaction puis ouvre un reglement suggere.","expected_result":"Recherche, liaison, wallet, devise et validation repondent correctement."},
    {"module_key":"trip","sort_order":3,"title":"Recap, historique et documents","instructions":"Teste balances, filtres historique et documents d une depense.","expected_result":"Montants, actions et liens restent disponibles apres rafraichissement."},

    {"module_key":"sport","sort_order":1,"title":"Programme et edition","instructions":"Ouvre le programme, modifie une seance de test et controle exercices, series et repos.","expected_result":"La seance persiste sans perdre son ordre ni ses charges."},
    {"module_key":"sport","sort_order":2,"title":"Timer et fin de seance","instructions":"Lance une seance courte, termine une serie, un repos puis sauvegarde.","expected_result":"Le timer, la notification et la fenetre de fin produisent un historique complet."},
    {"module_key":"sport","sort_order":3,"title":"Profil et mesures","instructions":"Ouvre progression, impedance, VMA et mobilite puis sauvegarde une mesure de test.","expected_result":"La mesure persiste et les graphiques se rechargent sans module manquant."},

    {"module_key":"nutrition","sort_order":1,"title":"Repas et eau","instructions":"Ajoute un repas et de l eau puis change de date et reviens.","expected_result":"La timeline et les totaux affichent les donnees sur la bonne date."},
    {"module_key":"nutrition","sort_order":2,"title":"Objectif et KPI","instructions":"Modifie l objectif nutrition puis ouvre les KPI.","expected_result":"Calories et macros cibles sont conservees et lues par les KPI."},
    {"module_key":"nutrition","sort_order":3,"title":"Hors ligne et synchronisation","instructions":"Teste un ajout en attente puis Synchroniser, Supprimer ou Vider.","expected_result":"La file locale reste explicite et aucune saisie n est perdue silencieusement."},

    {"module_key":"work","sort_order":1,"title":"Mission et periode","instructions":"Cree puis modifie une mission et une periode professionnelle de test.","expected_result":"Dates, employeur, poste et statut persistent dans la fresque."},
    {"module_key":"work","sort_order":2,"title":"Revenu","instructions":"Ajoute un revenu lie a une mission puis controle les montants.","expected_result":"Net, brut, devise et periode restent lies a la bonne mission."},
    {"module_key":"work","sort_order":3,"title":"Activite et KPI","instructions":"Ajoute une journee physique puis ouvre Dashboard ou KPI.","expected_result":"Duree et calories se repercutent sans double comptage."},

    {"module_key":"assets","sort_order":1,"title":"Cycle actif","instructions":"Cree un actif de test, modifie sa valeur et ses proprietaires.","expected_result":"Valeur, parts et cout mensuel persistent avec un total de parts coherent."},
    {"module_key":"assets","sort_order":2,"title":"Liens financiers","instructions":"Lie une transaction et une depense Trip puis teste l exclusion budget.","expected_result":"Les liens restent visibles et l achat n est pas compte deux fois."},
    {"module_key":"assets","sort_order":3,"title":"Documents et mobile","instructions":"Ajoute ou lie un document puis ouvre le detail sur mobile.","expected_result":"Apercu, deliaison et actions restent accessibles sans debordement."},

    {"module_key":"cautions","sort_order":1,"title":"Creation caution","instructions":"Cree une caution de test avec montant, devise et dates.","expected_result":"La caution apparait avec le bon statut et les bonnes valeurs."},
    {"module_key":"cautions","sort_order":2,"title":"Evolution du statut","instructions":"Modifie la caution puis marque sa restitution ou sa retenue.","expected_result":"L historique et les montants restent coherents apres rafraichissement."},
    {"module_key":"cautions","sort_order":3,"title":"Responsive","instructions":"Controle liste et formulaire a 1440 px et 390 px.","expected_result":"Aucune action ne disparait et aucun debordement horizontal apparait."},

    {"module_key":"documents","sort_order":1,"title":"Import et classement","instructions":"Ajoute un document de test, classe-le dans un dossier et ajoute un tag.","expected_result":"Le fichier, le dossier et les tags persistent."},
    {"module_key":"documents","sort_order":2,"title":"Recherche et apercu","instructions":"Recherche le document, change le tri et ouvre l apercu puis les infos.","expected_result":"La selection reste stable et aucun rendu legacy de secours n apparait."},
    {"module_key":"documents","sort_order":3,"title":"Liens metier","instructions":"Lie puis delie le document d une transaction ou d un actif.","expected_result":"Les deux modules affichent la meme relation et la suppression est propre."},

    {"module_key":"inbox","sort_order":1,"title":"Chargement et compteurs","instructions":"Ouvre A traiter depuis un chargement frais.","expected_result":"Le domaine charge a la demande et les compteurs correspondent aux cartes."},
    {"module_key":"inbox","sort_order":2,"title":"Filtres et recherche","instructions":"Change le statut et recherche un libelle connu.","expected_result":"Les cartes se filtrent sans perdre le focus ni devenir vides a tort."},
    {"module_key":"inbox","sort_order":3,"title":"Actions sources","instructions":"Ouvre une demande Trip ou un document depuis sa carte.","expected_result":"La destination correcte s ouvre et le statut reste coherent."},

    {"module_key":"notifications","sort_order":1,"title":"Centre et compteur","instructions":"Ouvre le centre avec au moins une notification non lue.","expected_result":"Le compteur et la liste affichent le meme nombre de non-lues."},
    {"module_key":"notifications","sort_order":2,"title":"Lecture et navigation","instructions":"Clique une notification liee a un module.","expected_result":"Elle passe lue et ouvre la destination sans ecran bloque."},
    {"module_key":"notifications","sort_order":3,"title":"Preferences mobiles","instructions":"Modifie une preference puis relance l application Android.","expected_result":"Le choix persiste et les notifications autorisees restent fonctionnelles."},

    {"module_key":"help","sort_order":1,"title":"Recherche francaise","instructions":"Recherche budget, Trip et suppression de compte.","expected_result":"Des reponses pertinentes et lisibles apparaissent pour chaque terme."},
    {"module_key":"help","sort_order":2,"title":"Recherche anglaise","instructions":"Passe en anglais et recherche budget puis shared expenses.","expected_result":"Le contenu anglais charge sans bloquer l application."},
    {"module_key":"help","sort_order":3,"title":"Navigation et mobile","instructions":"Ouvre plusieurs reponses a 390 px puis reviens au module precedent.","expected_result":"Aucun debordement et la navigation conserve son etat."}
  ]$scenarios$::jsonb) as x(module_key text,sort_order int,title text,instructions text,expected_result text)
), resolved as (
  select m.campaign_id, m.id as module_id, s.*
  from seed s
  join public.app_test_modules m
    on m.campaign_id = '20000000-0000-4000-8000-000000000001'
   and m.module_key = s.module_key
)
insert into public.app_test_scenarios (id, campaign_id, module_id, title, instructions, expected_result, required, sort_order)
select md5(module_id::text || ':' || sort_order::text)::uuid,
       campaign_id, module_id, title, instructions, expected_result, true, sort_order
from resolved
on conflict (module_id, sort_order) do update set
  title = excluded.title,
  instructions = excluded.instructions,
  expected_result = excluded.expected_result,
  required = excluded.required;
