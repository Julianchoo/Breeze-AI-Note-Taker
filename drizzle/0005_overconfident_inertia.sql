ALTER TABLE "meetings" ADD COLUMN "speaker_names" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "speaker_suggestions" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "ai_context" text;