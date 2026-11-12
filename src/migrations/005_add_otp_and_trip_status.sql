-- Migration: 005_add_otp_and_trip_status.sql
-- Description: Adds otp, started_at, and completed_at columns to rides table for secure passenger ride verification

ALTER TABLE rides
ADD COLUMN IF NOT EXISTS otp VARCHAR(10) DEFAULT '';

ALTER TABLE rides
ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE rides
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_rides_status ON rides(status);

