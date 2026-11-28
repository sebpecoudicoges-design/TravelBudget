-- Read-only audit candidate, fixture schema only. No accounts or IDs in the result.
WITH target_transactions AS (
  SELECT id FROM transactions WHERE user_id = $1
),
references_to_target AS (
  SELECT CASE WHEN g.user_id = $1 THEN 'own_trip' ELSE 'protected_trip' END AS scope
  FROM target_transactions t
  JOIN trip_expenses e ON e.transaction_id = t.id
  LEFT JOIN trip_groups g ON g.id = e.trip_id
)
SELECT (SELECT count(*)::int FROM target_transactions) AS private_transactions,
       count(*) FILTER (WHERE scope = 'protected_trip')::int AS protected_trip_links,
       count(*) FILTER (WHERE scope = 'own_trip')::int AS own_trip_links,
       CASE WHEN count(*) FILTER (WHERE scope = 'protected_trip') > 0
       THEN 'blocked_protected_trip' ELSE 'requires_full_dependency_check' END AS status
FROM references_to_target;
