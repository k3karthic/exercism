CREATE TABLE "order" (
	"id" serial PRIMARY KEY NOT NULL,
	"pet_id" integer,
	"quantity" integer,
	"ship_date" timestamp with time zone,
	"status" varchar(20),
	"complete" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pet" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"photo_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"category" jsonb,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text
);
