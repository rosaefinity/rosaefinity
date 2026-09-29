-- Update Pro plan maxProfiles from 5 to 10
-- Idempotent: only updates if current value is 5 (safe to re-run)
UPDATE "public"."Plan"
SET "maxProfiles" = 10, "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'pro' AND "maxProfiles" = 5;
