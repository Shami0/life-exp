CREATE TYPE "public"."repeat_type" AS ENUM('none', 'daily', 'weekdays');--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "repeat_type" "repeat_type" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "repeat_days" smallint[];--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "start_date" date;