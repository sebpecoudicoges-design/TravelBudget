-- Keep the authenticated-user scope, invoker security and existing column contract.
-- Match tripBalanceSign: shared income reverses expense balance; non-due income is neutral.
create or replace view public.v_trip_user_net_balances with (security_invoker = true) as
 WITH my_members AS (
         SELECT tm.trip_id,
            tm.id AS member_id
           FROM trip_members tm
          WHERE tm.auth_user_id = auth.uid()
        ), accessible_trips AS (
         SELECT tg.id AS trip_id,
            tg.name AS trip_name
           FROM trip_groups tg
          WHERE (EXISTS ( SELECT 1
                   FROM trip_participants tp
                  WHERE tp.trip_id = tg.id AND tp.auth_user_id = auth.uid()))
        ), paid AS (
         SELECT te.trip_id,
            te.currency,
            sum(te.amount * (case when te.kind = 'income' then case when coalesce(te.income_due_back, true) then -1 else 0 end else 1 end)) AS paid_amount
           FROM trip_expenses te
             JOIN my_members mm ON mm.trip_id = te.trip_id AND mm.member_id = te.paid_by_member_id
          GROUP BY te.trip_id, te.currency
        ), owed AS (
         SELECT te.trip_id,
            te.currency,
            sum(ts.share_amount * (case when te.kind = 'income' then case when coalesce(te.income_due_back, true) then -1 else 0 end else 1 end)) AS owed_amount
           FROM trip_expense_shares ts
             JOIN trip_expenses te ON te.id = ts.expense_id
             JOIN my_members mm ON mm.trip_id = te.trip_id AND mm.member_id = ts.member_id
          GROUP BY te.trip_id, te.currency
        ), settle_from AS (
         SELECT se.trip_id,
            se.currency,
            sum(se.amount) AS settle_from_amount
           FROM trip_settlement_events se
             JOIN my_members mm ON mm.trip_id = se.trip_id AND mm.member_id = se.from_member_id
          WHERE se.cancelled_at IS NULL
          GROUP BY se.trip_id, se.currency
        ), settle_to AS (
         SELECT se.trip_id,
            se.currency,
            sum(se.amount) AS settle_to_amount
           FROM trip_settlement_events se
             JOIN my_members mm ON mm.trip_id = se.trip_id AND mm.member_id = se.to_member_id
          WHERE se.cancelled_at IS NULL
          GROUP BY se.trip_id, se.currency
        ), currencies AS (
         SELECT paid.trip_id,
            paid.currency
           FROM paid
        UNION
         SELECT owed.trip_id,
            owed.currency
           FROM owed
        UNION
         SELECT settle_from.trip_id,
            settle_from.currency
           FROM settle_from
        UNION
         SELECT settle_to.trip_id,
            settle_to.currency
           FROM settle_to
        )
 SELECT at.trip_id,
    at.trip_name,
    c.currency,
    COALESCE(p.paid_amount, 0::numeric) AS paid,
    COALESCE(o.owed_amount, 0::numeric) AS owed,
    COALESCE(sf.settle_from_amount, 0::numeric) AS settled_out,
    COALESCE(st.settle_to_amount, 0::numeric) AS settled_in,
    COALESCE(p.paid_amount, 0::numeric) - COALESCE(o.owed_amount, 0::numeric) + COALESCE(sf.settle_from_amount, 0::numeric) - COALESCE(st.settle_to_amount, 0::numeric) AS net
   FROM accessible_trips at
     JOIN currencies c ON c.trip_id = at.trip_id
     LEFT JOIN paid p ON p.trip_id = at.trip_id AND p.currency = c.currency
     LEFT JOIN owed o ON o.trip_id = at.trip_id AND o.currency = c.currency
     LEFT JOIN settle_from sf ON sf.trip_id = at.trip_id AND sf.currency = c.currency
     LEFT JOIN settle_to st ON st.trip_id = at.trip_id AND st.currency = c.currency;
 -- New descendant retests; preserve earlier feedback and all existing results.
insert into public.app_test_scenarios
(id, campaign_id, module_id, parent_scenario_id, title, instructions, expected_result, required, sort_order)
select md5(c.id::text || ':' || v.key)::uuid, c.id, m.id, parent.id,
v.title, v.instructions, v.expected, true, v.sort_order
from public.app_test_campaigns c
join public.app_test_modules m on m.campaign_id=c.id
join (values
('analysis','analysis-net-trend-10.5.368','Budget net et projection Analyse 10.5.368',
'Sur la plage 15/05 au 02/10, compare le bilan a date et la projection finale. Exclure puis reinclure Autre. Controler les avoirs et les frais de virement en modes paye puis paye + a payer, en clair/sombre a 1440/390 px.',
'Le bilan a date reste distinct de l economie projetee. La projection conserve les economies et les depenses futures connues. Le capital des virements est exclu, leurs frais budgetaires sont inclus; une estimation remplacee par des frais payes lies n est pas double-comptee.',3681),
('dashboard','trip-net-income-10.5.368','Soldes Trip signes dans la projection 10.5.368',
'Ouvre la projection Dashboard et le recap Trip PVT Australie. Compare les soldes AUD et EUR, puis Amsterdam V2. Controle une entree partagee et une entree sans dette.',
'Les deux modules partagent le meme solde. Au jeu de donnees audite le 18/09, PVT Australie vaut 8,32 AUD + 96,78 EUR et Amsterdam 164,97 EUR. Les entrees sans dette sont neutres, les reglements annules restent exclus.',3682)
) v(module_key,key,title,instructions,expected,sort_order) on v.module_key=m.module_key
left join lateral (select s.id from public.app_test_scenarios s where s.module_id=m.id
and s.title not in ('Budget net et projection Analyse 10.5.368','Soldes Trip signes dans la projection 10.5.368')
order by s.sort_order desc limit 1) parent on true
where c.slug='stabilisation-modules-10-5-316'
on conflict (id) do nothing;

update public.app_test_modules m set status='in_test', archived_at=null, archive_reason=null, updated_at=now()
from public.app_test_campaigns c where m.campaign_id=c.id
and c.slug='stabilisation-modules-10-5-316' and m.module_key in ('analysis','dashboard');

insert into public.app_test_results (campaign_id,scenario_id,user_id,status,notes,completed_at)
select s.campaign_id,s.id,u.id,'pending',null,null
from public.app_test_scenarios s cross join public.profiles u
where s.title in ('Budget net et projection Analyse 10.5.368','Soldes Trip signes dans la projection 10.5.368')
and u.email in ('seb.pecoud@gmail.com','seb.pecoud.icoges@gmail.com')
and not exists(select 1 from public.app_test_results r where r.scenario_id=s.id and r.user_id=u.id and r.archived_at is null);

update public.app_test_campaigns set app_version='10.5.368',updated_at=now()
where slug='stabilisation-modules-10-5-316';
