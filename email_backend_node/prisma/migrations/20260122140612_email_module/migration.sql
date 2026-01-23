-- CreateEnum
CREATE TYPE "EmailType" AS ENUM ('NIL_FILING', 'VAT_FILING', 'GST_FILING', 'ITR_SUBMISSION', 'DOC_REQUEST', 'COMPLIANCE_NOTICE', 'RTI_SUBMISSION', 'GENERAL');

-- CreateEnum
CREATE TYPE "ThreadStatus" AS ENUM ('awaiting_reply', 'replied', 'resolved', 'archived');

-- CreateEnum
CREATE TYPE "EmailDirection" AS ENUM ('incoming', 'outgoing');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('draft', 'sent', 'received', 'failed');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'accountant', 'client_manager');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "token_expires_at" TIMESTAMP(3),
    "graph_subscription_id" TEXT,
    "graph_subscription_expires_at" TIMESTAMP(3),
    "role" "UserRole" NOT NULL DEFAULT 'accountant',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "default_signature_id" TEXT,
    "last_email_sync_time" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "client_type" TEXT,
    "tax_year" TEXT,
    "pan" TEXT,
    "gstin" TEXT,
    "tan" TEXT,
    "contact_person_name" TEXT,
    "contact_person_email" TEXT,
    "contact_person_phone" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_threads" (
    "id" TEXT NOT NULL,
    "client_id" TEXT,
    "subject" VARCHAR(500) NOT NULL,
    "email_type" "EmailType",
    "conversation_id" TEXT,
    "tax_email_id" TEXT,
    "first_message_id" TEXT,
    "last_message_id" TEXT,
    "message_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_activity_at" TIMESTAMP(3),
    "status" "ThreadStatus" NOT NULL DEFAULT 'awaiting_reply',
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "is_flagged" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "email_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emails" (
    "id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "graph_message_id" TEXT,
    "subject" VARCHAR(500) NOT NULL,
    "body" TEXT,
    "body_html" TEXT,
    "body_preview" VARCHAR(500),
    "from_address" TEXT NOT NULL,
    "from_name" TEXT,
    "to_recipients" JSONB NOT NULL DEFAULT '[]',
    "cc_recipients" JSONB NOT NULL DEFAULT '[]',
    "bcc_recipients" JSONB NOT NULL DEFAULT '[]',
    "reply_to" JSONB NOT NULL DEFAULT '[]',
    "internet_message_id" TEXT,
    "in_reply_to_id" TEXT,
    "references" TEXT,
    "conversation_id" TEXT,
    "conversation_index" TEXT,
    "tax_email_id" TEXT,
    "email_type" "EmailType",
    "client_id" TEXT,
    "user_id" TEXT,
    "direction" "EmailDirection",
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "status" "EmailStatus" NOT NULL DEFAULT 'received',
    "received_date_time" TIMESTAMP(3),
    "sent_date_time" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "has_attachments" BOOLEAN NOT NULL DEFAULT false,
    "attachment_count" INTEGER NOT NULL DEFAULT 0,
    "is_flagged" BOOLEAN NOT NULL DEFAULT false,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "importance" TEXT NOT NULL DEFAULT 'normal',
    "folder_id" TEXT,
    "folder_name" TEXT,

    CONSTRAINT "emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_attachments" (
    "id" TEXT NOT NULL,
    "email_id" TEXT NOT NULL,
    "graph_attachment_id" TEXT,
    "file_name" VARCHAR(500) NOT NULL,
    "file_size" INTEGER,
    "content_type" TEXT,
    "storage_key" TEXT,
    "storage_url" TEXT,
    "is_inline" BOOLEAN NOT NULL DEFAULT false,
    "content_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_signatures" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "signature_html" TEXT,
    "signature_text" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_footers" (
    "id" TEXT NOT NULL,
    "client_id" TEXT,
    "name" VARCHAR(100) NOT NULL,
    "footer_html" TEXT,
    "footer_text" TEXT,
    "applies_to_type" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_footers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_templates" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "email_type" "EmailType",
    "subject_template" VARCHAR(500) NOT NULL,
    "body_template" TEXT,
    "body_html_template" TEXT,
    "variables" JSONB NOT NULL DEFAULT '[]',
    "created_by" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "email_id" TEXT,
    "thread_id" TEXT,
    "client_id" TEXT,
    "action" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" VARCHAR(500),
    "details" JSONB NOT NULL DEFAULT '{}',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "clients_pan_key" ON "clients"("pan");

-- CreateIndex
CREATE INDEX "clients_name_idx" ON "clients"("name");

-- CreateIndex
CREATE INDEX "clients_pan_idx" ON "clients"("pan");

-- CreateIndex
CREATE INDEX "clients_client_type_idx" ON "clients"("client_type");

-- CreateIndex
CREATE UNIQUE INDEX "email_threads_tax_email_id_key" ON "email_threads"("tax_email_id");

-- CreateIndex
CREATE INDEX "email_threads_client_id_idx" ON "email_threads"("client_id");

-- CreateIndex
CREATE INDEX "email_threads_conversation_id_idx" ON "email_threads"("conversation_id");

-- CreateIndex
CREATE INDEX "email_threads_tax_email_id_idx" ON "email_threads"("tax_email_id");

-- CreateIndex
CREATE INDEX "email_threads_email_type_idx" ON "email_threads"("email_type");

-- CreateIndex
CREATE INDEX "email_threads_status_activity_idx" ON "email_threads"("status", "last_activity_at");

-- CreateIndex
CREATE UNIQUE INDEX "emails_graph_message_id_key" ON "emails"("graph_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "emails_internet_message_id_key" ON "emails"("internet_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "emails_tax_email_id_key" ON "emails"("tax_email_id");

-- CreateIndex
CREATE INDEX "emails_thread_id_idx" ON "emails"("thread_id");

-- CreateIndex
CREATE INDEX "emails_graph_message_id_idx" ON "emails"("graph_message_id");

-- CreateIndex
CREATE INDEX "emails_from_address_idx" ON "emails"("from_address");

-- CreateIndex
CREATE INDEX "emails_received_date_time_idx" ON "emails"("received_date_time");

-- CreateIndex
CREATE INDEX "emails_email_type_idx" ON "emails"("email_type");

-- CreateIndex
CREATE INDEX "emails_user_received_idx" ON "emails"("user_id", "received_date_time");

-- CreateIndex
CREATE INDEX "emails_client_type_idx" ON "emails"("client_id", "email_type");

-- CreateIndex
CREATE INDEX "email_signatures_user_id_idx" ON "email_signatures"("user_id");

-- CreateIndex
CREATE INDEX "email_footers_client_id_idx" ON "email_footers"("client_id");

-- CreateIndex
CREATE INDEX "email_templates_email_type_idx" ON "email_templates"("email_type");

-- CreateIndex
CREATE INDEX "audit_logs_user_action_idx" ON "audit_logs"("user_id", "action", "timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_client_action_idx" ON "audit_logs"("client_id", "action", "timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_email_action_idx" ON "audit_logs"("email_id", "action");

-- AddForeignKey
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emails" ADD CONSTRAINT "emails_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "email_threads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emails" ADD CONSTRAINT "emails_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emails" ADD CONSTRAINT "emails_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_attachments" ADD CONSTRAINT "email_attachments_email_id_fkey" FOREIGN KEY ("email_id") REFERENCES "emails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_signatures" ADD CONSTRAINT "email_signatures_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_footers" ADD CONSTRAINT "email_footers_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_email_id_fkey" FOREIGN KEY ("email_id") REFERENCES "emails"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "email_threads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
