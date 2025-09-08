-- Migration: Create new_attendance_records table for P/A/HD system
-- Version: 003_create_new_attendance_records
-- Description: Add new attendance system with P/A/HD values and approval workflow

CREATE TABLE IF NOT EXISTS new_attendance_records (
  id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL REFERENCES workers(id),
  site_id TEXT NOT NULL REFERENCES sites(id),
  date DATE NOT NULL,
  P DECIMAL(5,2) NOT NULL DEFAULT 0,
  A DECIMAL(5,2) NOT NULL DEFAULT 0,
  HD DECIMAL(5,2) NOT NULL DEFAULT 0,
  interpretation_mode TEXT NOT NULL CHECK (interpretation_mode IN ('TOTAL_COUNT', 'P_ONLY')) DEFAULT 'TOTAL_COUNT',
  submitted_by TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')) DEFAULT 'PENDING',
  approved_by TEXT REFERENCES users(id),
  approved_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(worker_id, date)
);

CREATE INDEX IF NOT EXISTS idx_new_attendance_worker_date ON new_attendance_records(worker_id, date);
CREATE INDEX IF NOT EXISTS idx_new_attendance_site_date ON new_attendance_records(site_id, date);
CREATE INDEX IF NOT EXISTS idx_new_attendance_status ON new_attendance_records(status);
CREATE INDEX IF NOT EXISTS idx_new_attendance_submitted_by ON new_attendance_records(submitted_by);

-- Update trigger for updated_at
CREATE TRIGGER IF NOT EXISTS update_new_attendance_updated_at
  AFTER UPDATE ON new_attendance_records
  FOR EACH ROW
BEGIN
  UPDATE new_attendance_records 
  SET updated_at = CURRENT_TIMESTAMP 
  WHERE id = NEW.id;
END;
