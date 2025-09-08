-- Initial schema for Hajiri Attendance System (SQLite)
-- Version: 001
-- Created: 2025-09-07

-- Create users table
CREATE TABLE users (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'FOREMAN' CHECK (role IN ('FOREMAN', 'SITE_INCHARGE', 'ADMIN')),
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create sites table
CREATE TABLE sites (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
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
CREATE TABLE workers (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    father_name TEXT NOT NULL,
    adhar_number_encrypted TEXT,
    phone_number TEXT,
    site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create user_site_assignments table
CREATE TABLE user_site_assignments (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, site_id)
);

-- Create attendance_records table
CREATE TABLE attendance_records (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    worker_id TEXT NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
    date TEXT NOT NULL, -- DATE format (YYYY-MM-DD)
    status TEXT NOT NULL CHECK (status IN ('PRESENT', 'ABSENT')),
    x_value INTEGER NOT NULL DEFAULT 0,
    y_value INTEGER NOT NULL DEFAULT 0,
    calculated_hours REAL NOT NULL DEFAULT 0,
    submitted_by TEXT NOT NULL REFERENCES users(id),
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    submitted_to_incharge INTEGER NOT NULL DEFAULT 0,
    verified INTEGER NOT NULL DEFAULT 0,
    approved_by TEXT REFERENCES users(id),
    approved_at DATETIME,
    original_status TEXT CHECK (original_status IN ('PRESENT', 'ABSENT')),
    original_x_value INTEGER,
    original_y_value INTEGER,
    UNIQUE(worker_id, date)
);

-- Create audit_logs table
CREATE TABLE audit_logs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'APPROVE')),
    changed_by TEXT NOT NULL REFERENCES users(id),
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    old_values TEXT, -- JSON as TEXT in SQLite
    new_values TEXT, -- JSON as TEXT in SQLite
    metadata TEXT    -- JSON as TEXT in SQLite
);

-- Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_workers_site_id ON workers(site_id);
CREATE INDEX idx_workers_active ON workers(is_active);
CREATE INDEX idx_user_site_assignments_user_id ON user_site_assignments(user_id);
CREATE INDEX idx_user_site_assignments_site_id ON user_site_assignments(site_id);
CREATE INDEX idx_attendance_records_site_date ON attendance_records(site_id, date);
CREATE INDEX idx_attendance_records_worker_date ON attendance_records(worker_id, date);
CREATE INDEX idx_attendance_records_submitted_by ON attendance_records(submitted_by);
CREATE INDEX idx_attendance_records_pending ON attendance_records(verified, site_id) WHERE verified = 0;
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);

-- Create triggers for updated_at (SQLite style)
CREATE TRIGGER update_users_updated_at 
AFTER UPDATE ON users 
FOR EACH ROW 
BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_sites_updated_at 
AFTER UPDATE ON sites 
FOR EACH ROW 
BEGIN
    UPDATE sites SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_workers_updated_at 
AFTER UPDATE ON workers 
FOR EACH ROW 
BEGIN
    UPDATE workers SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
