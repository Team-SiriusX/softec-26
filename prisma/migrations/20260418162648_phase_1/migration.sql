-- CreateEnum
CREATE TYPE "Role" AS ENUM ('WORKER', 'VERIFIER', 'ADVOCATE');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "WorkerCategory" AS ENUM ('RIDE_HAILING', 'FOOD_DELIVERY', 'FREELANCE_DESIGN', 'DOMESTIC_WORK', 'OTHER');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FLAGGED', 'UNVERIFIABLE');

-- CreateEnum
CREATE TYPE "ScreenshotStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FLAGGED', 'UNVERIFIABLE');

-- CreateEnum
CREATE TYPE "GrievanceStatus" AS ENUM ('OPEN', 'TAGGED', 'ESCALATED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "GrievanceCategory" AS ENUM ('COMMISSION_CHANGE', 'ACCOUNT_DEACTIVATION', 'PAYMENT_DISPUTE', 'UNFAIR_RATING', 'SAFETY_CONCERN', 'OTHER');

-- CreateEnum
CREATE TYPE "CertificateStatus" AS ENUM ('GENERATED', 'EXPIRED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "password_hash" TEXT,
    "role" "Role" NOT NULL DEFAULT 'WORKER',
    "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "full_name" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "city_zone" TEXT,
    "category" "WorkerCategory",
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "image" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jwks" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "privateKey" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "jwks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platforms" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platforms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_logs" (
    "id" TEXT NOT NULL,
    "worker_id" TEXT NOT NULL,
    "platform_id" TEXT NOT NULL,
    "shift_date" DATE NOT NULL,
    "hours_worked" DECIMAL(5,2) NOT NULL,
    "gross_earned" DECIMAL(10,2) NOT NULL,
    "platform_deductions" DECIMAL(10,2) NOT NULL,
    "net_received" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "imported_via_csv" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "screenshots" (
    "id" TEXT NOT NULL,
    "shift_log_id" TEXT NOT NULL,
    "verifier_id" TEXT,
    "file_url" TEXT NOT NULL,
    "file_key" TEXT NOT NULL,
    "status" "ScreenshotStatus" NOT NULL DEFAULT 'PENDING',
    "verifier_notes" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "screenshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anomaly_flags" (
    "id" TEXT NOT NULL,
    "worker_id" TEXT NOT NULL,
    "shift_log_id" TEXT NOT NULL,
    "flag_type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "z_score" DECIMAL(8,4),
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anomaly_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grievances" (
    "id" TEXT NOT NULL,
    "worker_id" TEXT,
    "platform_id" TEXT,
    "category" "GrievanceCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "GrievanceStatus" NOT NULL DEFAULT 'OPEN',
    "is_anonymous" BOOLEAN NOT NULL DEFAULT false,
    "cluster_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grievances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grievance_tags" (
    "id" TEXT NOT NULL,
    "grievance_id" TEXT NOT NULL,
    "advocate_id" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grievance_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grievance_escalations" (
    "id" TEXT NOT NULL,
    "grievance_id" TEXT NOT NULL,
    "advocate_id" TEXT NOT NULL,
    "note" TEXT,
    "escalated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grievance_escalations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_platform_stats" (
    "id" TEXT NOT NULL,
    "platform_id" TEXT NOT NULL,
    "city_zone" TEXT NOT NULL,
    "category" "WorkerCategory" NOT NULL,
    "stat_date" DATE NOT NULL,
    "worker_count" INTEGER NOT NULL,
    "median_net_earned" DECIMAL(10,2) NOT NULL,
    "avg_commission_pct" DECIMAL(5,4) NOT NULL,
    "p25_net_earned" DECIMAL(10,2) NOT NULL,
    "p75_net_earned" DECIMAL(10,2) NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_platform_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vulnerability_flags" (
    "id" TEXT NOT NULL,
    "worker_id" TEXT NOT NULL,
    "flag_month" DATE NOT NULL,
    "prev_month_net" DECIMAL(10,2) NOT NULL,
    "curr_month_net" DECIMAL(10,2) NOT NULL,
    "drop_pct" DECIMAL(5,4) NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vulnerability_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "income_certificates" (
    "id" TEXT NOT NULL,
    "worker_id" TEXT NOT NULL,
    "from_date" DATE NOT NULL,
    "to_date" DATE NOT NULL,
    "total_verified" DECIMAL(10,2) NOT NULL,
    "shift_count" INTEGER NOT NULL,
    "platforms_list" TEXT[],
    "html_snapshot" TEXT NOT NULL,
    "status" "CertificateStatus" NOT NULL DEFAULT 'GENERATED',
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "income_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "platforms_name_key" ON "platforms"("name");

-- CreateIndex
CREATE UNIQUE INDEX "platforms_slug_key" ON "platforms"("slug");

-- CreateIndex
CREATE INDEX "shift_logs_worker_id_shift_date_idx" ON "shift_logs"("worker_id", "shift_date");

-- CreateIndex
CREATE INDEX "shift_logs_platform_id_shift_date_idx" ON "shift_logs"("platform_id", "shift_date");

-- CreateIndex
CREATE INDEX "shift_logs_worker_id_verification_status_idx" ON "shift_logs"("worker_id", "verification_status");

-- CreateIndex
CREATE UNIQUE INDEX "screenshots_shift_log_id_key" ON "screenshots"("shift_log_id");

-- CreateIndex
CREATE INDEX "screenshots_status_idx" ON "screenshots"("status");

-- CreateIndex
CREATE INDEX "screenshots_verifier_id_idx" ON "screenshots"("verifier_id");

-- CreateIndex
CREATE INDEX "anomaly_flags_worker_id_idx" ON "anomaly_flags"("worker_id");

-- CreateIndex
CREATE INDEX "anomaly_flags_shift_log_id_idx" ON "anomaly_flags"("shift_log_id");

-- CreateIndex
CREATE INDEX "grievances_status_idx" ON "grievances"("status");

-- CreateIndex
CREATE INDEX "grievances_category_idx" ON "grievances"("category");

-- CreateIndex
CREATE INDEX "grievances_cluster_id_idx" ON "grievances"("cluster_id");

-- CreateIndex
CREATE INDEX "grievances_platform_id_idx" ON "grievances"("platform_id");

-- CreateIndex
CREATE UNIQUE INDEX "grievance_tags_grievance_id_tag_key" ON "grievance_tags"("grievance_id", "tag");

-- CreateIndex
CREATE INDEX "daily_platform_stats_stat_date_idx" ON "daily_platform_stats"("stat_date");

-- CreateIndex
CREATE INDEX "daily_platform_stats_platform_id_stat_date_idx" ON "daily_platform_stats"("platform_id", "stat_date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_platform_stats_platform_id_city_zone_category_stat_da_key" ON "daily_platform_stats"("platform_id", "city_zone", "category", "stat_date");

-- CreateIndex
CREATE INDEX "vulnerability_flags_flag_month_idx" ON "vulnerability_flags"("flag_month");

-- CreateIndex
CREATE UNIQUE INDEX "vulnerability_flags_worker_id_flag_month_key" ON "vulnerability_flags"("worker_id", "flag_month");

-- CreateIndex
CREATE INDEX "income_certificates_worker_id_idx" ON "income_certificates"("worker_id");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_logs" ADD CONSTRAINT "shift_logs_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_logs" ADD CONSTRAINT "shift_logs_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "platforms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "screenshots" ADD CONSTRAINT "screenshots_shift_log_id_fkey" FOREIGN KEY ("shift_log_id") REFERENCES "shift_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "screenshots" ADD CONSTRAINT "screenshots_verifier_id_fkey" FOREIGN KEY ("verifier_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anomaly_flags" ADD CONSTRAINT "anomaly_flags_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anomaly_flags" ADD CONSTRAINT "anomaly_flags_shift_log_id_fkey" FOREIGN KEY ("shift_log_id") REFERENCES "shift_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grievances" ADD CONSTRAINT "grievances_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grievance_tags" ADD CONSTRAINT "grievance_tags_grievance_id_fkey" FOREIGN KEY ("grievance_id") REFERENCES "grievances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grievance_tags" ADD CONSTRAINT "grievance_tags_advocate_id_fkey" FOREIGN KEY ("advocate_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grievance_escalations" ADD CONSTRAINT "grievance_escalations_grievance_id_fkey" FOREIGN KEY ("grievance_id") REFERENCES "grievances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "income_certificates" ADD CONSTRAINT "income_certificates_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
