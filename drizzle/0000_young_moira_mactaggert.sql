CREATE TABLE "pattern_definitions" (
	"id" varchar(20) PRIMARY KEY NOT NULL,
	"category" varchar(10) NOT NULL,
	"title" varchar(255) NOT NULL,
	"problem" text NOT NULL,
	"when_to_use" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	"deleted_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "pattern_implementations" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pattern_id" varchar(20) NOT NULL,
	"author_id" integer,
	"author_name" varchar(255) NOT NULL,
	"sas_code" text,
	"r_code" text,
	"considerations" text[],
	"variations" text[],
	"status" varchar(20) DEFAULT 'pending',
	"is_premium" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	"deleted_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_id" varchar(255),
	"email" varchar(255) NOT NULL,
	"name" varchar(255),
	"role" varchar(50) DEFAULT 'contributor',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_clerk_id_unique" UNIQUE("clerk_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "pattern_implementations" ADD CONSTRAINT "pattern_implementations_pattern_id_pattern_definitions_id_fk" FOREIGN KEY ("pattern_id") REFERENCES "public"."pattern_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pattern_implementations" ADD CONSTRAINT "pattern_implementations_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_pattern_definitions_category" ON "pattern_definitions" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_pattern_definitions_is_deleted" ON "pattern_definitions" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "idx_pattern_implementations_pattern_id" ON "pattern_implementations" USING btree ("pattern_id");--> statement-breakpoint
CREATE INDEX "idx_pattern_implementations_status" ON "pattern_implementations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_pattern_implementations_author_id" ON "pattern_implementations" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "idx_pattern_implementations_is_deleted" ON "pattern_implementations" USING btree ("is_deleted");