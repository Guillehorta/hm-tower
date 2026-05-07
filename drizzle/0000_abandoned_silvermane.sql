CREATE TYPE "public"."employee_status" AS ENUM('Ativo', 'Inativo');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('Ativa', 'Inativa');--> statement-breakpoint
CREATE TYPE "public"."time_log_type" AS ENUM('ENTRADA', 'SAÍDA');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('Administrador', 'Gestor', 'Usuário');--> statement-breakpoint
CREATE TABLE "companies" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"cnpj" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"role" text,
	"cpf" text NOT NULL,
	"status" "employee_status" DEFAULT 'Ativo' NOT NULL,
	"project" text,
	"photo_base64" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "fvs" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text,
	"name" text NOT NULL,
	"revision" text NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text,
	"name" text NOT NULL,
	"status" "project_status" DEFAULT 'Ativa' NOT NULL,
	"construction_units" jsonb DEFAULT '[]'::jsonb,
	"cost_structure" jsonb DEFAULT '[]'::jsonb,
	"fvs_mapping" jsonb DEFAULT '{}'::jsonb,
	"teams" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "service_executions" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"service_path" text NOT NULL,
	"component_path" text,
	"fvs_results" jsonb DEFAULT '{}'::jsonb,
	"start_date_real" text,
	"end_date_real" text
);
--> statement-breakpoint
CREATE TABLE "time_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"employee_id" text NOT NULL,
	"type" time_log_type NOT NULL,
	"timestamp" timestamp NOT NULL,
	"location" jsonb,
	"captured_photo" text,
	"verified" boolean DEFAULT false,
	"confidence" integer
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" "user_role" DEFAULT 'Usuário' NOT NULL,
	"companies" jsonb DEFAULT '[]'::jsonb,
	"projects" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "weather_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"date" text NOT NULL,
	"morning" jsonb,
	"afternoon" jsonb,
	"night" jsonb,
	"precipitation" integer,
	"created_at" timestamp DEFAULT now()
);
