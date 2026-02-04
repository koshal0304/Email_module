/*
  Warnings:

  - You are about to drop the column `unread_count` on the `email_threads` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "email_threads" DROP COLUMN "unread_count";
