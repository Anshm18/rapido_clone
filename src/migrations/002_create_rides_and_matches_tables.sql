-- Migration: 002_create_rides_and_matches_tables.sql
-- Description: Creates riders table, rides table, and matches table (linking user_id, rider_id, ride_id, status)

-- 1. Riders table (drivers/captains)
CREATE TABLE IF NOT EXISTS riders (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50) DEFAULT '',
  vehicle_type VARCHAR(50) NOT NULL, -- 'bike', 'rickshaw', 'taxi_basic', 'taxi_premium', 'taxi_luxury'
  vehicle_number VARCHAR(100) DEFAULT '',
  avatar TEXT DEFAULT '',
  rating NUMERIC(2, 1) DEFAULT 4.8,
  is_online BOOLEAN DEFAULT true,
  current_lat NUMERIC(10, 6),
  current_lng NUMERIC(10, 6),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Rides table (ride orders & routes)
CREATE TABLE IF NOT EXISTS rides (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  pickup_address TEXT NOT NULL,
  destination_address TEXT NOT NULL,
  pickup_lat NUMERIC(10, 6),
  pickup_lng NUMERIC(10, 6),
  dest_lat NUMERIC(10, 6),
  dest_lng NUMERIC(10, 6),
  vehicle_type VARCHAR(50) NOT NULL, -- 'bike', 'rickshaw', 'taxi_basic', 'taxi_premium', 'taxi_luxury'
  fare NUMERIC(10, 2) NOT NULL,
  distance_km NUMERIC(10, 2) DEFAULT 5.0,
  duration_min INTEGER DEFAULT 15,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'complete', 'failed'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Matches table (links user_id, rider_id, ride_id as foreign key, and status: pending, complete, failed)
CREATE TABLE IF NOT EXISTS matches (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  rider_id INTEGER REFERENCES riders(id) ON DELETE SET NULL,
  ride_id INTEGER REFERENCES rides(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'complete', 'failed'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rides_user_id ON rides(user_id);
CREATE INDEX IF NOT EXISTS idx_matches_user_id ON matches(user_id);
CREATE INDEX IF NOT EXISTS idx_matches_rider_id ON matches(rider_id);
CREATE INDEX IF NOT EXISTS idx_matches_ride_id ON matches(ride_id);

