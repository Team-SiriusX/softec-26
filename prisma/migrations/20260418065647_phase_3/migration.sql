/*
  Warnings:

  - You are about to drop the `users` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "account" DROP CONSTRAINT "account_userId_fkey";

-- DropForeignKey
ALTER TABLE "anomaly_flags" DROP CONSTRAINT "anomaly_flags_worker_id_fkey";

-- DropForeignKey
ALTER TABLE "grievance_tags" DROP CONSTRAINT "grievance_tags_advocate_id_fkey";

-- DropForeignKey
ALTER TABLE "grievances" DROP CONSTRAINT "grievances_worker_id_fkey";

-- DropForeignKey
ALTER TABLE "income_certificates" DROP CONSTRAINT "income_certificates_worker_id_fkey";

-- DropForeignKey
ALTER TABLE "refresh_tokens" DROP CONSTRAINT "refresh_tokens_user_id_fkey";

-- DropForeignKey
ALTER TABLE "screenshots" DROP CONSTRAINT "screenshots_verifier_id_fkey";

-- DropForeignKey
ALTER TABLE "session" DROP CONSTRAINT "session_userId_fkey";

-- DropForeignKey
ALTER TABLE "shift_logs" DROP CONSTRAINT "shift_logs_worker_id_fkey";

-- DropTable
DROP TABLE "users";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'WORKER',
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "city_zone" TEXT,
    "category" "WorkerCategory",
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "image" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_logs" ADD CONSTRAINT "shift_logs_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "screenshots" ADD CONSTRAINT "screenshots_verifier_id_fkey" FOREIGN KEY ("verifier_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anomaly_flags" ADD CONSTRAINT "anomaly_flags_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grievances" ADD CONSTRAINT "grievances_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grievance_tags" ADD CONSTRAINT "grievance_tags_advocate_id_fkey" FOREIGN KEY ("advocate_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "income_certificates" ADD CONSTRAINT "income_certificates_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
