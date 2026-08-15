-- Extend the existing 10.5.351 visual retest with the final cash summary and
-- calendar range controls added before release.
update public.app_test_scenarios scenario
set instructions = 'Compare une entree et une sortie en clair/sombre a 1440 et 390 px. Controle le bilan Total depenses, Total revenus et Difference, puis applique Periode du voyage, Mois dernier et Semaine derniere. Ouvre enfin le rail avec le compte admin.',
    expected_result = 'Prevu, reel et difference restent separes pour les entrees et sorties. Le bilan reel calcule revenus moins depenses, les plages changent les montants et les lignes, les cartes sont compactes et Membres reste en bas du rail sans logo parasite en haut.'
from public.app_test_campaigns campaign,
     public.app_test_modules module
where scenario.id = '35100000-0000-4000-8000-000000000002'::uuid
  and scenario.campaign_id = campaign.id
  and module.id = scenario.module_id
  and module.campaign_id = campaign.id
  and campaign.slug = 'stabilisation-modules-10-5-316'
  and module.module_key = 'subscriptions';
