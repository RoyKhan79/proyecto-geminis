-- CreateEnum
CREATE TYPE "RecurringChargeStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ENDED');

-- CreateEnum
CREATE TYPE "DirectDebitRunStatus" AS ENUM ('DRAFT', 'EXPORTED', 'SETTLED');

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "directDebitRunId" TEXT,
ADD COLUMN     "recurringChargeId" TEXT;

-- CreateTable
CREATE TABLE "billing_profiles" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL DEFAULT 'SIN_TENANT',
    "studentId" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'TRANSFER',
    "iban" TEXT,
    "holderName" TEXT,
    "mandateRef" TEXT,
    "mandateSignedAt" TIMESTAMP(3),
    "mandateUsed" BOOLEAN NOT NULL DEFAULT false,
    "chargeDay" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_charges" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL DEFAULT 'SIN_TENANT',
    "studentId" TEXT NOT NULL,
    "billingProfileId" TEXT,
    "enrollmentId" TEXT,
    "concept" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" "RecurringChargeStatus" NOT NULL DEFAULT 'ACTIVE',
    "startsOn" TIMESTAMP(3) NOT NULL,
    "endsOn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_charges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "direct_debit_runs" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL DEFAULT 'SIN_TENANT',
    "period" TIMESTAMP(3) NOT NULL,
    "chargeOn" TIMESTAMP(3) NOT NULL,
    "status" "DirectDebitRunStatus" NOT NULL DEFAULT 'DRAFT',
    "creditorName" TEXT NOT NULL,
    "creditorIban" TEXT NOT NULL,
    "creditorId" TEXT NOT NULL,
    "totalCents" INTEGER NOT NULL DEFAULT 0,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "exportedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "direct_debit_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "billing_profiles_studentId_key" ON "billing_profiles"("studentId");

-- CreateIndex
CREATE INDEX "billing_profiles_academyId_method_idx" ON "billing_profiles"("academyId", "method");

-- CreateIndex
CREATE UNIQUE INDEX "recurring_charges_student_unique" ON "recurring_charges"("studentId");

-- CreateIndex
CREATE INDEX "recurring_charges_academyId_status_idx" ON "recurring_charges"("academyId", "status");

-- CreateIndex
CREATE INDEX "direct_debit_runs_academyId_status_idx" ON "direct_debit_runs"("academyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "direct_debit_runs_academyId_period_key" ON "direct_debit_runs"("academyId", "period");

-- CreateIndex
CREATE INDEX "payments_academyId_directDebitRunId_idx" ON "payments"("academyId", "directDebitRunId");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_recurringChargeId_fkey" FOREIGN KEY ("recurringChargeId") REFERENCES "recurring_charges"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_directDebitRunId_fkey" FOREIGN KEY ("directDebitRunId") REFERENCES "direct_debit_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_profiles" ADD CONSTRAINT "billing_profiles_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_profiles" ADD CONSTRAINT "billing_profiles_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_charges" ADD CONSTRAINT "recurring_charges_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_charges" ADD CONSTRAINT "recurring_charges_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_charges" ADD CONSTRAINT "recurring_charges_billingProfileId_fkey" FOREIGN KEY ("billingProfileId") REFERENCES "billing_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_charges" ADD CONSTRAINT "recurring_charges_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direct_debit_runs" ADD CONSTRAINT "direct_debit_runs_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
