-- Migration: Add seed data for development and testing (SQLite)
-- Version: 002
-- Created: 2025-09-07

-- Insert default admin user (password: admin123)
INSERT OR IGNORE INTO users (id, name, email, password_hash, role) VALUES 
('admin-user-id-001', 'System Admin', 'admin@hajiri.local', '$2b$10$rQZ8kHWfQxwjQxwjQxwjQOK8kHWfQxwjQxwjQxwjQxwjQxwjQxwjQ.', 'ADMIN');

-- Insert sample sites
INSERT OR IGNORE INTO sites (id, name, location, notes, full_day_hours, interpretation_mode, checkpoint_time, timezone) VALUES 
('site-construction-001', 'Construction Site Alpha', 'Downtown Construction Zone', 'Main construction project', 8, 'HOURS', '08:00:00', 'UTC'),
('site-agricultural-002', 'Agricultural Farm Beta', 'Rural Farm Area', 'Seasonal agricultural work', 10, 'HALF_DAYS', '06:00:00', 'UTC'),
('site-industrial-003', 'Industrial Site Gamma', 'Industrial District', 'Manufacturing facility', 8, 'HOURS', '07:30:00', 'UTC');

-- Insert sample users (foremen and site incharges)
INSERT OR IGNORE INTO users (id, name, email, phone, password_hash, role, is_active) VALUES 
('user-foreman-001', 'John Foreman', 'john.foreman@hajiri.local', '+1234567890', '$2b$10$rQZ8kHWfQxwjQxwjQxwjQOK8kHWfQxwjQxwjQxwjQxwjQxwjQxwjQ.', 'FOREMAN', 1),
('user-incharge-001', 'Sarah Supervisor', 'sarah.supervisor@hajiri.local', '+1234567891', '$2b$10$rQZ8kHWfQxwjQxwjQxwjQOK8kHWfQxwjQxwjQxwjQxwjQxwjQxwjQ.', 'SITE_INCHARGE', 1),
('user-foreman-002', 'Mike Manager', 'mike.manager@hajiri.local', '+1234567892', '$2b$10$rQZ8kHWfQxwjQxwjQOK8kHWfQxwjQxwjQxwjQxwjQxwjQxwjQxwjQ.', 'FOREMAN', 1),
('user-incharge-002', 'Lisa Leader', 'lisa.leader@hajiri.local', '+1234567893', '$2b$10$rQZ8kHWfQxwjQxwjQOK8kHWfQxwjQxwjQxwjQxwjQxwjQxwjQxwjQ.', 'SITE_INCHARGE', 1);

-- Assign users to sites
INSERT OR IGNORE INTO user_site_assignments (user_id, site_id) VALUES 
('user-foreman-001', 'site-construction-001'),  -- John Foreman -> Construction Site Alpha
('user-incharge-001', 'site-construction-001'), -- Sarah Supervisor -> Construction Site Alpha
('user-foreman-002', 'site-agricultural-002'),  -- Mike Manager -> Agricultural Farm Beta
('user-incharge-002', 'site-agricultural-002'), -- Lisa Leader -> Agricultural Farm Beta
('user-foreman-001', 'site-industrial-003'),    -- John Foreman -> Industrial Site Gamma
('user-incharge-002', 'site-industrial-003');   -- Lisa Leader -> Industrial Site Gamma

-- Insert sample workers
INSERT OR IGNORE INTO workers (id, name, father_name, adhar_number_encrypted, phone_number, site_id, is_active) VALUES 
-- Workers for Construction Site Alpha
('worker-construction-001', 'Rajesh Kumar', 'Suresh Kumar', NULL, '+9876543210', 'site-construction-001', 1),
('worker-construction-002', 'Amit Singh', 'Ramesh Singh', NULL, '+9876543211', 'site-construction-001', 1),
('worker-construction-003', 'Priya Sharma', 'Mohan Sharma', NULL, '+9876543212', 'site-construction-001', 1),
('worker-construction-004', 'Vikram Patel', 'Kiran Patel', NULL, '+9876543213', 'site-construction-001', 1),
('worker-construction-005', 'Sunita Devi', 'Ram Lal', NULL, '+9876543214', 'site-construction-001', 1),

-- Workers for Agricultural Farm Beta
('worker-agricultural-001', 'Ravi Yadav', 'Shyam Yadav', NULL, '+9876543215', 'site-agricultural-002', 1),
('worker-agricultural-002', 'Geeta Kumari', 'Hari Prasad', NULL, '+9876543216', 'site-agricultural-002', 1),
('worker-agricultural-003', 'Manoj Gupta', 'Raj Kumar Gupta', NULL, '+9876543217', 'site-agricultural-002', 1),

-- Workers for Industrial Site Gamma
('worker-industrial-001', 'Deepak Verma', 'Ashok Verma', NULL, '+9876543218', 'site-industrial-003', 1),
('worker-industrial-002', 'Kavita Joshi', 'Prakash Joshi', NULL, '+9876543219', 'site-industrial-003', 1);

-- Insert sample attendance records (recent days)
INSERT OR IGNORE INTO attendance_records (
  id, site_id, worker_id, date, status, x_value, y_value, calculated_hours, 
  submitted_by, submitted_to_incharge, verified
) VALUES 
-- Construction Site Alpha - Recent attendance
('attendance-001', 'site-construction-001', 'worker-construction-001', date('now', '-1 day'), 'PRESENT', 1, 0, 8.0, 'user-foreman-001', 1, 0),
('attendance-002', 'site-construction-001', 'worker-construction-002', date('now', '-1 day'), 'PRESENT', 1, 2, 10.0, 'user-foreman-001', 1, 0),
('attendance-003', 'site-construction-001', 'worker-construction-003', date('now', '-1 day'), 'ABSENT', 0, 0, 0.0, 'user-foreman-001', 1, 0),
('attendance-004', 'site-construction-001', 'worker-construction-004', date('now', '-1 day'), 'PRESENT', 1, 1, 9.0, 'user-foreman-001', 1, 0),

-- Agricultural Farm Beta - Recent attendance (half-day mode)
('attendance-005', 'site-agricultural-002', 'worker-agricultural-001', date('now', '-1 day'), 'PRESENT', 1, 1, 15.0, 'user-foreman-002', 1, 1),
('attendance-006', 'site-agricultural-002', 'worker-agricultural-002', date('now', '-1 day'), 'PRESENT', 0, 2, 10.0, 'user-foreman-002', 1, 1),

-- Industrial Site Gamma - Recent attendance
('attendance-007', 'site-industrial-003', 'worker-industrial-001', date('now', '-1 day'), 'PRESENT', 1, 0, 8.0, 'user-foreman-001', 1, 0),
('attendance-008', 'site-industrial-003', 'worker-industrial-002', date('now', '-1 day'), 'PRESENT', 1, 3, 11.0, 'user-foreman-001', 1, 0);

-- Update approved records with approval information
UPDATE attendance_records 
SET 
  approved_by = 'user-incharge-002',
  approved_at = datetime('now', '-2 hours')
WHERE site_id = 'site-agricultural-002' AND verified = 1;

-- Insert sample audit logs
INSERT OR IGNORE INTO audit_logs (id, entity_type, entity_id, action, changed_by, old_values, new_values, metadata) VALUES 
('audit-001', 'attendance_records', 'attendance-005', 'APPROVE', 'user-incharge-002',
 '{"verified": false}', '{"verified": true, "approved_by": "user-incharge-002"}',
 '{"approval_notes": "Approved after verification"}'),
('audit-002', 'workers', 'worker-construction-001', 'CREATE', 'user-foreman-001',
 null, '{"name": "Rajesh Kumar", "father_name": "Suresh Kumar", "site_id": "site-construction-001"}',
 '{"created_via": "seed_data"}');
