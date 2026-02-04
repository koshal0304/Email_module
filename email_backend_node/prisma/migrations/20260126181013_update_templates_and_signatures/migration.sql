/*
  Warnings:

  - A unique constraint covering the columns `[default_signature_id]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "email_templates" ADD COLUMN     "bcc_template" TEXT,
ADD COLUMN     "cc_template" TEXT,
ADD COLUMN     "to_template" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_default_signature_id_key" ON "users"("default_signature_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_default_signature_id_fkey" FOREIGN KEY ("default_signature_id") REFERENCES "email_signatures"("id") ON DELETE SET NULL ON UPDATE CASCADE;
