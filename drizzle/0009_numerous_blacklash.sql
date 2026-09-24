ALTER TABLE "meetings" ADD COLUMN "share_token" uuid;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "share_summary" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "share_recording" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "share_transcript" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_share_token_unique" UNIQUE("share_token");