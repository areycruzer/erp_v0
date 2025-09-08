-- Migration: Add database indexes for audit_logs table
-- This migration adds performance indexes for common query patterns on audit_logs

-- Index on timestamp for chronological queries (most common)
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp 
ON audit_logs(timestamp DESC);

-- Index on entity_type for filtering by table/entity type
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type 
ON audit_logs(entity_type);

-- Index on changed_by for user activity queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_by 
ON audit_logs(changed_by);

-- Index on action for filtering by operation type
CREATE INDEX IF NOT EXISTS idx_audit_logs_action 
ON audit_logs(action);

-- Composite index for entity-specific queries (entity_type + entity_id)
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity 
ON audit_logs(entity_type, entity_id);

-- Composite index for user activity within date range
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_timestamp 
ON audit_logs(changed_by, timestamp DESC);

-- Composite index for entity type and timestamp (common filtering pattern)
CREATE INDEX IF NOT EXISTS idx_audit_logs_type_timestamp 
ON audit_logs(entity_type, timestamp DESC);
