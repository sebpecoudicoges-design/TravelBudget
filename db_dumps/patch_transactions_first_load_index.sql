-- Patch V9.7.1 - first-load performance
-- Speeds up the main transactions read:
--   WHERE user_id = ... AND travel_id = ... ORDER BY created_at ASC

CREATE INDEX IF NOT EXISTS "transactions_user_travel_created_idx"
ON "public"."transactions" USING "btree" ("user_id", "travel_id", "created_at");

ANALYZE "public"."transactions";
