-- Migration: 003_seed_sample_riders.sql
-- Description: Inserts sample riders for bike, rickshaw, and taxi tiers so ride requests and matches succeed

INSERT INTO riders (name, email, phone, vehicle_type, vehicle_number, rating, is_online, current_lat, current_lng)
VALUES
  ('Rahul Sharma', 'rahul.bike@uberclone.com', '+91 9876543211', 'bike', 'DL-01-AB-1234', 4.9, true, 28.6139, 77.2090),
  ('Amit Kumar', 'amit.rickshaw@uberclone.com', '+91 9876543212', 'rickshaw', 'DL-02-CD-5678', 4.8, true, 28.6145, 77.2085),
  ('Vikas Singh', 'vikas.basic@uberclone.com', '+91 9876543213', 'taxi_basic', 'DL-03-EF-9012', 4.7, true, 28.6150, 77.2100),
  ('Sandeep Verma', 'sandeep.prem@uberclone.com', '+91 9876543214', 'taxi_premium', 'DL-04-GH-3456', 4.95, true, 28.6130, 77.2075),
  ('Vikramaditya Roy', 'vikram.lux@uberclone.com', '+91 9876543215', 'taxi_luxury', 'DL-05-IJ-7890', 5.0, true, 28.6160, 77.2110)
ON CONFLICT (email) DO NOTHING;

