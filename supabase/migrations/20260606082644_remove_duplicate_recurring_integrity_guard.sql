-- The existing trg_recurring_rules_consistency_guard already enforces
-- recurring rule wallet/user/travel consistency and date normalization.
-- Remove the duplicate guard introduced during the hardening pass.

drop trigger if exists recurring_rules_integrity_guard on public.recurring_rules;
drop function if exists public.recurring_validate_rule_integrity();
