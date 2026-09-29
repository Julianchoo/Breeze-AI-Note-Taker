ALTER TABLE "meeting_chunks" ALTER COLUMN "blob_path" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "meetings" DROP COLUMN "share_recording";