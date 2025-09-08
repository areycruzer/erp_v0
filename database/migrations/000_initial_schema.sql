-- Migration: Initial Schema for SQLite
-- Version: 000
-- Created: 2025-09-07T11:30:00.000Z

-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- Create attendance_status enum as CHECK constraint
-- SQLite doesn't have enums, so we'll use CHECK constraints

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('ADMIN', 'SITE_INCHARGE', 'FOREMAN')),
    is_active BOOLEAN NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create sites table
CREATE TABLE IF NOT EXISTS sites (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT,
    notes TEXT,
    full_day_hours INTEGER NOT NULL DEFAULT 8,
    interpretation_mode TEXT NOT NULL DEFAULT 'HOURS' CHECK (interpretation_mode IN ('HOURS', 'HALF_DAYS')),
    checkpoint_time TEXT NOT NULL DEFAULT '08:00:00',
    timezone TEXT NOT NULL DEFAULT 'UTC',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create workers table
CREATE TABLE IF NOT EXISTS workers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    father_name TEXT NOT NULL,
    adhar_number_encrypted TEXT,
    phone_number TEXT,
    site_id TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
);

-- Create user_site_assignments table
CREATE TABLE IF NOT EXISTS user_site_assignments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    site_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
    UNIQUE(user_id, site_id)
);

-- Create attendance_records table
CREATE TABLE IF NOT EXISTS attendance_records (
    id TEXT PRIMARY KEY,
    site_id TEXT NOT NULL,
    worker_id TEXT NOT NULL,
    date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PRESENT', 'ABSENT', 'HALF_DAY')),
    x_value INTEGER NOT NULL DEFAULT 0,
    y_value INTEGER NOT NULL DEFAULT 0,
    calculated_hours DECIMAL(5,2) NOT NULL DEFAULT 0,
    submitted_by TEXT NOT NULL,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    submitted_to_incharge BOOLEAN NOT NULL DEFAULT 0,
    verified BOOLEAN NOT NULL DEFAULT 0,
    approved_by TEXT,
    approved_at DATETIME,
    original_status TEXT CHECK (original_status IN ('PRESENT', 'ABSENT', 'HALF_DAY')),
    original_x_value INTEGER,
    original_y_value INTEGER,
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
    FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE,
    FOREIGN KEY (submitted_by) REFERENCES users(id),
    FOREIGN KEY (approved_by) REFERENCES users(id),
    UNIQUE(worker_id, date)
);

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    changed_by TEXT NOT NULL,
    old_values TEXT,
    new_values TEXT,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (changed_by) REFERENCES users(id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_workers_site_id ON workers(site_id);
CREATE INDEX IF NOT EXISTS idx_workers_active ON workers(is_active);
CREATE INDEX IF NOT EXISTS idx_user_site_assignments_user_id ON user_site_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_site_assignments_site_id ON user_site_assignments(site_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_site_id ON attendance_records(site_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_worker_id ON attendance_records(worker_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_date ON attendance_records(date);
CREATE INDEX IF NOT EXISTS idx_attendance_records_status ON attendance_records(status);
CREATE INDEX IF NOT EXISTS idx_attendance_records_verified ON attendance_records(verified);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_by ON audit_logs(changed_by);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- Function to generate UUID (SQLite doesn't have native UUID generation)
-- We'll use a simple text-based ID generation in the application layer

-- Triggers for updated_at timestamps
CREATE TRIGGER IF NOT EXISTS users_updated_at 
AFTER UPDATE ON users 
BEGIN 
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS sites_updated_at 
AFTER UPDATE ON sites 
BEGIN 
    UPDATE sites SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS workers_updated_at 
AFTER UPDATE ON workers 
BEGIN 
    UPDATE workers SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
