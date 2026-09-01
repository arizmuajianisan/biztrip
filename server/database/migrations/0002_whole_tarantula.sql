ALTER TABLE "receipts" ADD COLUMN "display_r2_key" text;--> statement-breakpoint
ALTER TABLE "receipts" ADD COLUMN "display_content_type" text;--> statement-breakpoint
ALTER TABLE "receipts" ADD COLUMN "display_size" numeric(12, 0);