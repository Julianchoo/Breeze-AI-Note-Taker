CREATE TABLE "ai_cost_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"stage" text NOT NULL,
	"model" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"provider_request_id" text,
	"cost_usd" double precision,
	"reserved_usd" double precision DEFAULT 0 NOT NULL,
	"pricing_version" text NOT NULL,
	"usage" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "soniox_cost_attempt_id" uuid;--> statement-breakpoint
ALTER TABLE "ai_cost_attempts" ADD CONSTRAINT "ai_cost_attempts_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_cost_attempts" ADD CONSTRAINT "ai_cost_attempts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_cost_attempts_meeting_idx" ON "ai_cost_attempts" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "ai_cost_attempts_user_status_idx" ON "ai_cost_attempts" USING btree ("user_id","status");