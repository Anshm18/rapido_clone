-- Migration: 001_create_users_table.sql
-- Description: Creates the initial users table and indexes for Uber Clone authentication

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255),
  google_id VARCHAR(255) UNIQUE,
  avatar TEXT DEFAULT '',
  role VARCHAR(50) DEFAULT 'rider',
  phone VARCHAR(50) DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Performance indexes for lookup by email and google_id
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

