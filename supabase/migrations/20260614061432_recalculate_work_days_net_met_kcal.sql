update public.work_days
set
  estimated_kcal = round((
    greatest(0, coalesce(met_value, 4.8) - 1)
    * greatest(1, coalesce(body_weight_kg, 70))
    * (greatest(0, coalesce(duration_minutes, 0) - coalesce(break_minutes, 0)) / 60.0)
  )::numeric, 2),
  updated_at = now()
where true;
