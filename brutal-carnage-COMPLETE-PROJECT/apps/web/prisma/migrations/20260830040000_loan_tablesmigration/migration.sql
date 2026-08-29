-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAID', 'REJECTED', 'DEFAULTED');

-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "principal" DECIMAL(12,2) NOT NULL,
    "amountOwed" DECIMAL(12,2) NOT NULL,
    "interestRate" DECIMAL(5,4) NOT NULL DEFAULT 0.12,
    "status" "LoanStatus" NOT NULL DEFAULT 'PENDING',
    "userId" TEXT NOT NULL,
    "reason" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionNote" TEXT,
    "lastAccrualAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanRepayment" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoanRepayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Loan_status_idx" ON "Loan"("status");

-- CreateIndex
CREATE INDEX "Loan_userId_idx" ON "Loan"("userId");

-- CreateIndex
CREATE INDEX "LoanRepayment_loanId_idx" ON "LoanRepayment"("loanId");

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanRepayment" ADD CONSTRAINT "LoanRepayment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
