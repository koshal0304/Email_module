/*
  Warnings:

  - You are about to drop the column `bcc_template` on the `email_templates` table. All the data in the column will be lost.
  - You are about to drop the column `body_html_template` on the `email_templates` table. All the data in the column will be lost.
  - You are about to drop the column `body_template` on the `email_templates` table. All the data in the column will be lost.
  - You are about to drop the column `cc_template` on the `email_templates` table. All the data in the column will be lost.
  - You are about to drop the column `created_by` on the `email_templates` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `email_templates` table. All the data in the column will be lost.
  - You are about to drop the column `email_type` on the `email_templates` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `email_templates` table. All the data in the column will be lost.
  - You are about to drop the column `subject_template` on the `email_templates` table. All the data in the column will be lost.
  - You are about to drop the column `to_template` on the `email_templates` table. All the data in the column will be lost.
  - You are about to drop the column `usage_count` on the `email_templates` table. All the data in the column will be lost.
  - You are about to drop the column `variables` on the `email_templates` table. All the data in the column will be lost.
  - Added the required column `body` to the `email_templates` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subject` to the `email_templates` table without a default value. This is not possible if the table is not empty.
  - Added the required column `template_name` to the `email_templates` table without a default value. This is not possible if the table is not empty.
  - Added the required column `template_type` to the `email_templates` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TemplateType" AS ENUM ('NIL_CONFIRMATION', 'CHECKLIST', 'COI', 'ITR');

-- CreateEnum
CREATE TYPE "TriggerType" AS ENUM ('DATE', 'HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "AttachmentType" AS ENUM ('FILE', 'IMAGE');

-- CreateEnum
CREATE TYPE "AttachmentSource" AS ENUM ('STATIC', 'GENERATED', 'VARIABLE');

-- DropForeignKey
ALTER TABLE "email_templates" DROP CONSTRAINT "email_templates_created_by_fkey";

-- DropIndex
DROP INDEX "email_templates_email_type_idx";

-- AlterTable
ALTER TABLE "email_templates" DROP COLUMN "bcc_template",
DROP COLUMN "body_html_template",
DROP COLUMN "body_template",
DROP COLUMN "cc_template",
DROP COLUMN "created_by",
DROP COLUMN "description",
DROP COLUMN "email_type",
DROP COLUMN "name",
DROP COLUMN "subject_template",
DROP COLUMN "to_template",
DROP COLUMN "usage_count",
DROP COLUMN "variables",
ADD COLUMN     "bcc" TEXT,
ADD COLUMN     "body" TEXT NOT NULL,
ADD COLUMN     "cc" TEXT,
ADD COLUMN     "created_by_id" TEXT,
ADD COLUMN     "duplicated_from_id" TEXT,
ADD COLUMN     "is_reminder_template" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "modified_by_id" TEXT,
ADD COLUMN     "signature_id" TEXT,
ADD COLUMN     "subject" VARCHAR(500) NOT NULL,
ADD COLUMN     "template_name" VARCHAR(200) NOT NULL,
ADD COLUMN     "template_type" "TemplateType" NOT NULL,
ADD COLUMN     "to" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "name" TEXT;

-- CreateTable
CREATE TABLE "template_configurations" (
    "id" TEXT NOT NULL,
    "email_template_id" TEXT NOT NULL,
    "trigger_type" "TriggerType" NOT NULL,
    "trigger_date" TIMESTAMP(3),
    "trigger_time" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "template_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminder_configurations" (
    "id" TEXT NOT NULL,
    "email_template_id" TEXT NOT NULL,
    "reminder_starts_after_days" INTEGER NOT NULL,
    "repeat_every_days" INTEGER NOT NULL,
    "max_reminders" INTEGER NOT NULL,
    "send_time" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reminder_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_attachments" (
    "id" TEXT NOT NULL,
    "email_template_id" TEXT NOT NULL,
    "name" VARCHAR(500) NOT NULL,
    "file_url" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "attachment_type" "AttachmentType" NOT NULL,
    "source" "AttachmentSource" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "template_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_variables" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "template_type" "TemplateType",
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "template_variables_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "template_configurations_email_template_id_key" ON "template_configurations"("email_template_id");

-- CreateIndex
CREATE UNIQUE INDEX "reminder_configurations_email_template_id_key" ON "reminder_configurations"("email_template_id");

-- CreateIndex
CREATE UNIQUE INDEX "template_variables_key_key" ON "template_variables"("key");

-- CreateIndex
CREATE INDEX "email_templates_duplicated_from_id_idx" ON "email_templates"("duplicated_from_id");

-- CreateIndex
CREATE INDEX "email_templates_template_type_idx" ON "email_templates"("template_type");

-- AddForeignKey
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_modified_by_id_fkey" FOREIGN KEY ("modified_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_signature_id_fkey" FOREIGN KEY ("signature_id") REFERENCES "email_signatures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_configurations" ADD CONSTRAINT "template_configurations_email_template_id_fkey" FOREIGN KEY ("email_template_id") REFERENCES "email_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_configurations" ADD CONSTRAINT "reminder_configurations_email_template_id_fkey" FOREIGN KEY ("email_template_id") REFERENCES "email_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_attachments" ADD CONSTRAINT "template_attachments_email_template_id_fkey" FOREIGN KEY ("email_template_id") REFERENCES "email_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
