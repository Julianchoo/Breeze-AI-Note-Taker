CREATE TABLE "meeting_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"blob_path" text NOT NULL,
	"sha256" text NOT NULL,
	"duration_seconds" double precision NOT NULL,
	"segments" jsonb
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'recording' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"duration_seconds" double precision DEFAULT 0 NOT NULL,
	"expected_chunks" integer,
	"summary" text,
	"detected_language" text,
	"error" text,
	"lease_token" uuid,
	"lease_until" timestamp,
	"failures" integer DEFAULT 0 NOT NULL,
	"speaker_references" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meeting_chunks" ADD CONSTRAINT "meeting_chunks_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "meeting_chunks_meeting_index_unique" ON "meeting_chunks" USING btree ("meeting_id","chunk_index");--> statement-breakpoint
CREATE INDEX "meetings_user_created_idx" ON "meetings" USING btree ("user_id","created_at");