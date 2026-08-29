-- Adds eventType to Event so announcements/reminders can tag the correct
-- Discord proof-submission channel for that event.
ALTER TABLE "Event" ADD COLUMN "eventType" TEXT;
