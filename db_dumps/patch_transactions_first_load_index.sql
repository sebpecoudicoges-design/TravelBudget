-- Patch V9.7.1 - first-load performance
-- Speeds up the main transactions read:
--   WHERE user_id = ... AND travel_id = ... ORDER BY created_at ASC

CREATE INDEX IF NOT EXISTS "transactions_user_travel_created_idx"
ON "public"."transactions" USING "btree" ("user_id", "travel_id", "created_at");

CREATE INDEX IF NOT EXISTS "budget_segments_user_period_sort_start_idx"
ON "public"."budget_segments" USING "btree" ("user_id", "period_id", "sort_order", "start_date");

ANALYZE "public"."transactions";
ANALYZE "public"."budget_segments";
