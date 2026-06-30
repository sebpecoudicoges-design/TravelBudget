-- A full payment linked to a shared Trip expense is wallet cashflow only.
-- The user's personal consumption share is carried by the distinct transaction
-- referenced from trip_expense_budget_links and is the only budget-side row.
update public.transactions payment
set out_of_budget = true,
    affects_budget = false,
    updated_at = now()
where payment.trip_expense_id is not null
  and payment.pay_now is true
  and exists (
    select 1
    from public.trip_expense_budget_links link
    where link.expense_id = payment.trip_expense_id
      and link.user_id = payment.user_id
      and link.transaction_id <> payment.id
  )
  and (payment.out_of_budget is distinct from true
    or payment.affects_budget is distinct from false);
