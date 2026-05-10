-- Verify the AUD coverage stored in public.fx_rates.
-- fx_rates stores EUR as base, so AUD/EUR = 1 / (rates->>'AUD').

select
  count(*) as aud_points_last_90_days,
  min(as_of) as first_day,
  max(as_of) as last_day,
  round(avg(1 / nullif((rates->>'AUD')::numeric, 0)), 6) as avg_aud_to_eur
from public.fx_rates
where base = 'EUR'
  and rates ? 'AUD'
  and as_of >= current_date - interval '90 days';

-- Inspect the daily AUD/EUR series used by the app when enough DB history exists.
select
  as_of,
  round(1 / nullif((rates->>'AUD')::numeric, 0), 6) as aud_to_eur,
  source
from public.fx_rates
where base = 'EUR'
  and rates ? 'AUD'
  and as_of >= current_date - interval '90 days'
order by as_of;
