-- Remove only generated, unpaid projections beyond max_occurrences.
-- Confirmed occurrences are immutable and count toward the configured limit.
with confirmed_counts as (
  select
    r.id as rule_id,
    r.max_occurrences,
    count(t.id) filter (
      where coalesce(t.pay_now, false)
         or coalesce(t.recurring_instance_status, '') = 'confirmed'
    )::integer as confirmed_count
  from public.recurring_rules r
  left join public.transactions t
    on t.recurring_rule_id = r.id
   and coalesce(t.generated_by_rule, false)
  where r.max_occurrences is not null
  group by r.id, r.max_occurrences
), mutable_ranked as (
  select
    t.id,
    row_number() over (
      partition by t.recurring_rule_id
      order by coalesce(t.occurrence_date, t.budget_date_start, t.date_start), t.created_at, t.id
    ) as mutable_rank,
    greatest(c.max_occurrences - c.confirmed_count, 0) as mutable_to_keep
  from public.transactions t
  join confirmed_counts c on c.rule_id = t.recurring_rule_id
  where coalesce(t.generated_by_rule, false)
    and coalesce(t.pay_now, false) = false
    and coalesce(t.recurring_instance_status, 'generated') <> 'confirmed'
)
delete from public.transactions t
using mutable_ranked ranked
where t.id = ranked.id
  and ranked.mutable_rank > ranked.mutable_to_keep;
