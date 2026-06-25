with duplicate_items as (
  select
    id,
    row_number() over (
      partition by
        user_id,
        meal_id,
        coalesce(food_key, ''),
        coalesce(label, ''),
        coalesce(grams, 0),
        coalesce(kcal, 0)
      order by created_at nulls last, id
    ) as rn
  from public.nutrition_meal_items
)
delete from public.nutrition_meal_items i
using duplicate_items d
where i.id = d.id
  and d.rn > 1;

with duplicate_meals as (
  select
    m.id,
    row_number() over (
      partition by
        m.user_id,
        m.meal_date,
        m.meal_type,
        coalesce(m.label, ''),
        coalesce(m.water_ml, 0),
        coalesce(i.food_key, ''),
        coalesce(i.label, ''),
        coalesce(i.grams, 0),
        coalesce(i.kcal, 0)
      order by m.created_at nulls last, m.id
    ) as rn
  from public.nutrition_meals m
  left join public.nutrition_meal_items i on i.meal_id = m.id
)
delete from public.nutrition_meals m
using duplicate_meals d
where m.id = d.id
  and d.rn > 1;

delete from public.nutrition_meals m
where m.user_id = (select id from auth.users where email = 'seb.pecoud.icoges@gmail.com')
  and m.meal_date = date '2026-06-25'
  and m.meal_type = 'breakfast'
  and m.label = 'Riz carotte brocoli oignon agneau'
  and exists (
    select 1
    from public.nutrition_meal_items i
    where i.meal_id = m.id
      and i.food_key = 'rice_carrot_broccoli_onion_lamb'
      and i.grams = 430
  );

create unique index if not exists nutrition_meal_items_exact_dedupe_idx
  on public.nutrition_meal_items (
    user_id,
    meal_id,
    coalesce(food_key, ''),
    coalesce(label, ''),
    coalesce(grams, 0),
    coalesce(kcal, 0)
  );
