ALTER TABLE "user" ADD COLUMN "spent_usd" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "cost_limit_usd" double precision DEFAULT 0.5 NOT NULL;--> statement-breakpoint
UPDATE "user" u SET "spent_usd" = s.total FROM (SELECT "user_id", sum("cost_usd") AS total FROM "meetings" WHERE "cost_usd" IS NOT NULL GROUP BY "user_id") s WHERE s."user_id" = u."id";