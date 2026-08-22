CREATE TYPE "public"."expense_category" AS ENUM('air_ticket', 'taxi_bus', 'hotel', 'train', 'travel_procedure', 'travel_insurance', 'other', 'per_diem');--> statement-breakpoint
CREATE TYPE "public"."rate_source" AS ENUM('api', 'manual');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('superadmin', 'admin', 'user');--> statement-breakpoint
CREATE TYPE "public"."trip_status" AS ENUM('active', 'closed');--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"category" "expense_category" NOT NULL,
	"amount" numeric(18, 4) NOT NULL,
	"currency" text NOT NULL,
	"fx_rate_to_home" numeric(18, 8) NOT NULL,
	"amount_home" numeric(18, 4) NOT NULL,
	"rate_source" "rate_source" DEFAULT 'api' NOT NULL,
	"spent_at" date NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expense_id" uuid NOT NULL,
	"r2_key" text NOT NULL,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size" numeric(12, 0) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"category" "expense_category" NOT NULL,
	"amount" numeric(18, 4) DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_currencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"currency" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"destination_country" text NOT NULL,
	"default_currency" text NOT NULL,
	"home_currency" text DEFAULT 'JPY' NOT NULL,
	"settlement_currency" text DEFAULT 'IDR' NOT NULL,
	"temporary_payment_amount" numeric(18, 4) DEFAULT 0 NOT NULL,
	"temporary_payment_currency" text DEFAULT 'JPY' NOT NULL,
	"temporary_payment_fx_rate_to_home" numeric(18, 8) DEFAULT 1 NOT NULL,
	"temporary_payment_amount_home" numeric(18, 4) DEFAULT 0 NOT NULL,
	"status" "trip_status" DEFAULT 'active' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"display_name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_budgets" ADD CONSTRAINT "trip_budgets_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_currencies" ADD CONSTRAINT "trip_currencies_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expenses_trip_id_idx" ON "expenses" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "receipts_expense_id_idx" ON "receipts" USING btree ("expense_id");--> statement-breakpoint
CREATE INDEX "trip_budgets_trip_id_idx" ON "trip_budgets" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "trip_currencies_trip_id_idx" ON "trip_currencies" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "trips_user_id_idx" ON "trips" USING btree ("user_id");