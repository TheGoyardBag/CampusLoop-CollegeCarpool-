-- Generated from the same model specification as schema.prisma.
-- Custom constraints below supplement the ORM model.
CREATE TABLE "Campus" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "timezone" TEXT NOT NULL,
  "emailDomain" TEXT NOT NULL
);
CREATE TABLE "Hub" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "campusId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "lat" DOUBLE PRECISION NOT NULL,
  "lng" DOUBLE PRECISION NOT NULL,
  "isCampus" BOOLEAN NOT NULL,
  "instructions" TEXT NOT NULL
);
CREATE TABLE "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "campusId" TEXT NOT NULL,
  "homeHubId" TEXT,
  "role" TEXT NOT NULL,
  "emailVerifiedAt" TIMESTAMPTZ(3),
  "suspendedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL
);
CREATE TABLE "Session" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL
);
CREATE TABLE "ActionToken" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "usedAt" TIMESTAMPTZ(3)
);
CREATE TABLE "Course" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "weekday" INTEGER NOT NULL,
  "startMinute" INTEGER NOT NULL,
  "endMinute" INTEGER NOT NULL,
  "termStart" TEXT NOT NULL,
  "termEnd" TEXT NOT NULL
);
CREATE TABLE "Vehicle" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "color" TEXT NOT NULL,
  "seats" INTEGER NOT NULL,
  "accessible" BOOLEAN NOT NULL
);
CREATE TABLE "Ride" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "campusId" TEXT NOT NULL,
  "driverId" TEXT NOT NULL,
  "vehicleId" TEXT NOT NULL,
  "originHubId" TEXT NOT NULL,
  "destinationHubId" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "departureAt" TIMESTAMPTZ(3) NOT NULL,
  "arrivalAt" TIMESTAMPTZ(3) NOT NULL,
  "capacity" INTEGER NOT NULL,
  "seatsUsed" INTEGER NOT NULL,
  "costCents" INTEGER NOT NULL,
  "quiet" BOOLEAN NOT NULL,
  "status" TEXT NOT NULL,
  "seriesId" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL
);
CREATE TABLE "Booking" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "rideId" TEXT NOT NULL,
  "riderId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "note" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL
);
CREATE TABLE "Message" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "rideId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL
);
CREATE TABLE "Notification" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "rideId" TEXT,
  "readAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL
);
CREATE TABLE "Report" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "reporterId" TEXT NOT NULL,
  "rideId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "resolution" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL,
  "resolvedAt" TIMESTAMPTZ(3)
);
CREATE TABLE "Audit" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "detail" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL
);
CREATE TABLE "Outbox" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "to" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL,
  "availableAt" TIMESTAMPTZ(3) NOT NULL,
  "sentAt" TIMESTAMPTZ(3),
  "claimedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL
);
CREATE TABLE "Idempotency" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL
);
CREATE TABLE "RateBucket" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "count" INTEGER NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL
);
CREATE TABLE "Review" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "rideId" TEXT NOT NULL,
  "reviewerId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL
);
ALTER TABLE "Hub" ADD CONSTRAINT "Hub_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_homeHubId_fkey" FOREIGN KEY ("homeHubId") REFERENCES "Hub"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActionToken" ADD CONSTRAINT "ActionToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Course" ADD CONSTRAINT "Course_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Ride" ADD CONSTRAINT "Ride_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Ride" ADD CONSTRAINT "Ride_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Ride" ADD CONSTRAINT "Ride_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Ride" ADD CONSTRAINT "Ride_originHubId_fkey" FOREIGN KEY ("originHubId") REFERENCES "Hub"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Ride" ADD CONSTRAINT "Ride_destinationHubId_fkey" FOREIGN KEY ("destinationHubId") REFERENCES "Hub"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "Ride"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "Ride"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "Ride"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "Ride"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Audit" ADD CONSTRAINT "Audit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Outbox" ADD CONSTRAINT "Outbox_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Idempotency" ADD CONSTRAINT "Idempotency_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Idempotency" ADD CONSTRAINT "Idempotency_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "Ride"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "User_email_key" ON "User" ("email");
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session" ("tokenHash");
CREATE UNIQUE INDEX "ActionToken_tokenHash_key" ON "ActionToken" ("tokenHash");
CREATE UNIQUE INDEX "Booking_rideId_riderId_key" ON "Booking" ("rideId", "riderId");
CREATE UNIQUE INDEX "Idempotency_userId_key_key" ON "Idempotency" ("userId", "key");
CREATE UNIQUE INDEX "Review_rideId_reviewerId_key" ON "Review" ("rideId", "reviewerId");
CREATE INDEX "Hub_campusId_idx" ON "Hub" ("campusId");
CREATE INDEX "User_campusId_idx" ON "User" ("campusId");
CREATE INDEX "Session_userId_idx" ON "Session" ("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session" ("expiresAt");
CREATE INDEX "ActionToken_userId_purpose_idx" ON "ActionToken" ("userId", "purpose");
CREATE INDEX "ActionToken_expiresAt_idx" ON "ActionToken" ("expiresAt");
CREATE INDEX "Course_userId_weekday_idx" ON "Course" ("userId", "weekday");
CREATE INDEX "Vehicle_userId_idx" ON "Vehicle" ("userId");
CREATE INDEX "Ride_campusId_status_departureAt_idx" ON "Ride" ("campusId", "status", "departureAt");
CREATE INDEX "Ride_driverId_status_idx" ON "Ride" ("driverId", "status");
CREATE INDEX "Booking_riderId_status_idx" ON "Booking" ("riderId", "status");
CREATE INDEX "Booking_rideId_status_createdAt_idx" ON "Booking" ("rideId", "status", "createdAt");
CREATE INDEX "Message_rideId_createdAt_idx" ON "Message" ("rideId", "createdAt");
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification" ("userId", "createdAt");
CREATE INDEX "Report_status_createdAt_idx" ON "Report" ("status", "createdAt");
CREATE INDEX "Audit_actorId_createdAt_idx" ON "Audit" ("actorId", "createdAt");
CREATE INDEX "Outbox_sentAt_availableAt_idx" ON "Outbox" ("sentAt", "availableAt");
CREATE INDEX "Idempotency_expiresAt_idx" ON "Idempotency" ("expiresAt");
CREATE INDEX "RateBucket_expiresAt_idx" ON "RateBucket" ("expiresAt");

ALTER TABLE "User" ADD CONSTRAINT "User_role_check" CHECK ("role" IN ('STUDENT','ADMIN'));
ALTER TABLE "User" ADD CONSTRAINT "User_email_normalized" CHECK ("email"=lower("email"));
ALTER TABLE "Course" ADD CONSTRAINT "Course_time_check" CHECK ("weekday" BETWEEN 1 AND 7 AND "startMinute">=0 AND "endMinute"<=1440 AND "endMinute">"startMinute" AND "termEnd">="termStart");
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_seats_check" CHECK ("seats" BETWEEN 1 AND 7);
ALTER TABLE "Ride" ADD CONSTRAINT "Ride_capacity_check" CHECK ("capacity" BETWEEN 1 AND 7 AND "seatsUsed" BETWEEN 0 AND "capacity");
ALTER TABLE "Ride" ADD CONSTRAINT "Ride_cost_check" CHECK ("costCents" BETWEEN 0 AND 3000);
ALTER TABLE "Ride" ADD CONSTRAINT "Ride_time_check" CHECK ("arrivalAt">"departureAt" AND "arrivalAt"-"departureAt" BETWEEN interval '5 minutes' AND interval '180 minutes');
ALTER TABLE "Ride" ADD CONSTRAINT "Ride_status_check" CHECK ("status" IN ('OPEN','CANCELLED','COMPLETED'));
ALTER TABLE "Ride" ADD CONSTRAINT "Ride_direction_check" CHECK ("direction" IN ('TO_CAMPUS','FROM_CAMPUS') AND "originHubId"<>"destinationHubId");
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_status_check" CHECK ("status" IN ('REQUESTED','WAITLISTED','CONFIRMED','DECLINED','CANCELLED'));
ALTER TABLE "Review" ADD CONSTRAINT "Review_rating_check" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "ActionToken" ADD CONSTRAINT "ActionToken_purpose_check" CHECK ("purpose" IN ('VERIFY_EMAIL','RESET_PASSWORD'));
ALTER TABLE "Report" ADD CONSTRAINT "Report_status_check" CHECK ("status" IN ('OPEN','RESOLVED'));
ALTER TABLE "Outbox" ADD CONSTRAINT "Outbox_attempts_check" CHECK ("attempts">=0);
