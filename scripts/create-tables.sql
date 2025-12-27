-- StatPatternHub Database Schema
-- Simplified schema without credit system (as per user requirements)

-- ============================================
-- 1. Users Table
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  clerk_id VARCHAR(255) UNIQUE,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'contributor', -- guest, contributor, premier, admin
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 2. Pattern Definitions (Immutable Container)
-- ============================================
CREATE TABLE IF NOT EXISTS pattern_definitions (
  id VARCHAR(20) PRIMARY KEY, -- e.g., 'IMP-001', 'DER-020'
  category VARCHAR(10) NOT NULL, -- e.g., 'IMP', 'DER', 'DAT'
  title VARCHAR(255) NOT NULL,
  problem TEXT NOT NULL,
  when_to_use TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 3. Pattern Implementations (Mutable Content)
-- ============================================
CREATE TABLE IF NOT EXISTS pattern_implementations (
  uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_id VARCHAR(20) NOT NULL REFERENCES pattern_definitions(id) ON DELETE CASCADE,
  author_id INTEGER REFERENCES users(id),
  author_name VARCHAR(255) NOT NULL, -- Denormalized for display
  sas_code TEXT,
  r_code TEXT,
  considerations TEXT[], -- Array of strings
  variations TEXT[], -- Array of strings
  status VARCHAR(20) DEFAULT 'pending', -- active, pending, rejected
  is_premium BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 4. Indexes for Performance
-- ============================================

-- Pattern definitions by category (for catalog filtering)
CREATE INDEX IF NOT EXISTS idx_pattern_definitions_category
  ON pattern_definitions(category);

-- Pattern implementations by pattern_id (for detail view)
CREATE INDEX IF NOT EXISTS idx_pattern_implementations_pattern_id
  ON pattern_implementations(pattern_id);

-- Pattern implementations by status (for filtering active/pending)
CREATE INDEX IF NOT EXISTS idx_pattern_implementations_status
  ON pattern_implementations(status);

-- Pattern implementations by author (for user contributions page)
CREATE INDEX IF NOT EXISTS idx_pattern_implementations_author_id
  ON pattern_implementations(author_id);

-- ============================================
-- 5. Seed System User (for default patterns)
-- ============================================
-- Insert system user WITHOUT specifying explicit ID
-- This allows PostgreSQL to auto-assign ID via sequence
INSERT INTO users (email, name, role)
VALUES ('system@statpatternhub.com', 'System', 'admin')
ON CONFLICT (email) DO NOTHING;

-- CRITICAL: Reset sequence to match current max ID
-- This prevents duplicate key errors on next auto-insert
SELECT setval('users_id_seq', (SELECT COALESCE(MAX(id), 1) FROM users));

-- ============================================
-- Database Schema Complete
-- ============================================
