-- Migration: Add clerk_id column to users table
-- Date: 2025-12-26
-- Purpose: Support Clerk authentication integration

-- Add clerk_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'clerk_id'
  ) THEN
    ALTER TABLE users ADD COLUMN clerk_id VARCHAR(255) UNIQUE;
    RAISE NOTICE 'Column clerk_id added to users table';
  ELSE
    RAISE NOTICE 'Column clerk_id already exists in users table';
  END IF;
END $$;

-- Update default role from 'guest' to 'contributor' for new users
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'contributor';
