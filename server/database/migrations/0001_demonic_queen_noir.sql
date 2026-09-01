ALTER TABLE "trips" ADD COLUMN "additional_payment_amount" numeric(18, 4) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "additional_payment_currency" text DEFAULT 'JPY' NOT NULL;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "additional_payment_fx_rate_to_home" numeric(18, 8) DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "additional_payment_amount_home" numeric(18, 4) DEFAULT 0 NOT NULL;