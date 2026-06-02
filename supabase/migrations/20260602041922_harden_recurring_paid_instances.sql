-- Harden recurring generated transactions:
-- paid generated instances must be immutable when a rule is edited.

update public.transactions
set recurring_instance_status = 'confirmed',
    updated_at = now()
where generated_by_rule is true
  and pay_now is true
  and coalesce(recurring_instance_status, '') <> 'confirmed';

update public.transactions
set recurring_instance_status = 'generated',
    updated_at = now()
where generated_by_rule is true
  and pay_now is false
  and recurring_instance_status is null;
