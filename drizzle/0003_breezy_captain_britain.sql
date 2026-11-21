ALTER TABLE "sites" ADD COLUMN "require_admin_two_factor" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "totp_secret_enc" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "totp_pending_secret_enc" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "totp_pending_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "totp_last_step" integer DEFAULT -1 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "recovery_code_hashes" text[] DEFAULT '{}' NOT NULL;