-- CreateTable
CREATE TABLE "TrackingEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT,
    "userId" TEXT,
    "sessionFingerprint" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "action" TEXT,
    "entity" TEXT,
    "entityId" TEXT,
    "browserFamily" TEXT NOT NULL,
    "browserVersion" TEXT,
    "osFamily" TEXT NOT NULL,
    "deviceType" TEXT NOT NULL,
    "isPWA" BOOLEAN NOT NULL DEFAULT false,
    "meta" TEXT,
    CONSTRAINT "TrackingEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TrackingEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TrackingEvent_tenantId_timestamp_idx" ON "TrackingEvent"("tenantId", "timestamp");

-- CreateIndex
CREATE INDEX "TrackingEvent_eventType_timestamp_idx" ON "TrackingEvent"("eventType", "timestamp");

-- CreateIndex
CREATE INDEX "TrackingEvent_path_timestamp_idx" ON "TrackingEvent"("path", "timestamp");

-- CreateIndex
CREATE INDEX "TrackingEvent_sessionFingerprint_idx" ON "TrackingEvent"("sessionFingerprint");
