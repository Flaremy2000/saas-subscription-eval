-- CreateTable
CREATE TABLE "user_usage_metrics" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "apiCalls" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "user_usage_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_usage_metrics_userId_date_idx" ON "user_usage_metrics"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "user_usage_metrics_companyId_userId_date_key" ON "user_usage_metrics"("companyId", "userId", "date");

-- AddForeignKey
ALTER TABLE "user_usage_metrics" ADD CONSTRAINT "user_usage_metrics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_usage_metrics" ADD CONSTRAINT "user_usage_metrics_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
