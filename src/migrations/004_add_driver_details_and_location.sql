-- Migration: 004_add_driver_details_and_location.sql
-- Description: Adds user_id and driving_license to riders table, plus performance indexes for live GPS radius queries

ALTER TABLE riders
ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE riders
ADD COLUMN IF NOT EXISTS driving_license VARCHAR(100) DEFAULT '';

-- Performance indexes for live driver radius location queries
CREATE INDEX IF NOT EXISTS idx_riders_vehicle_online ON riders(vehicle_type, is_online);
CREATE INDEX IF NOT EXISTS idx_riders_coords ON riders(current_lat, current_lng);
CREATE INDEX IF NOT EXISTS idx_riders_user_id ON riders(user_id);

