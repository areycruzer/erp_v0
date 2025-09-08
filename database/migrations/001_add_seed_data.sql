-- Migration: Add seed data for development and testing
-- Version: 001
-- Created: 2025-01-09T00:00:00.000Z

-- Insert sample sites
INSERT INTO sites (id, name, location, notes, full_day_hours, interpretation_mode, checkpoint_time, timezone) VALUES 
('550e8400-e29b-41d4-a716-446655440001', 'Construction Site Alpha', 'Downtown Construction Zone', 'Main construction project', 8, 'HOURS', '08:00:00', 'UTC'),
('550e8400-e29b-41d4-a716-446655440002', 'Agricultural Farm Beta', 'Rural Farm Area', 'Seasonal agricultural work', 10, 'HALF_DAYS', '06:00:00', 'UTC'),
('550e8400-e29b-41d4-a716-446655440003', 'Industrial Site Gamma', 'Industrial District', 'Manufacturing facility', 8, 'HOURS', '07:30:00', 'UTC')
ON CONFLICT (id) DO NOTHING;

-- Insert sample users (foremen and site incharges)
INSERT INTO users (id, name, email, phone, password_hash, role, is_active) VALUES 
('550e8400-e29b-41d4-a716-446655440011', 'John Foreman', 'john.foreman@hajiri.local', '+1234567890', '$2b$10$rQZ8kHWfQxwjQxwjQxwjQOK8kHWfQxwjQxwjQxwjQxwjQxwjQxwjQ.', 'FOREMAN', true),
('550e8400-e29b-41d4-a716-446655440012', 'Sarah Supervisor', 'sarah.supervisor@hajiri.local', '+1234567891', '$2b$10$rQZ8kHWfQxwjQxwjQxwjQOK8kHWfQxwjQxwjQxwjQxwjQxwjQxwjQ.', 'SITE_INCHARGE', true),
('550e8400-e29b-41d4-a716-446655440013', 'Mike Manager', 'mike.manager@hajiri.local', '+1234567892', '$2b$10$rQZ8kHWfQxwjQxwjQxwjQOK8kHWfQxwjQxwjQxwjQxwjQxwjQxwjQ.', 'FOREMAN', true),
('550e8400-e29b-41d4-a716-446655440014', 'Lisa Leader', 'lisa.leader@hajiri.local', '+1234567893', '$2b$10$rQZ8kHWfQxwjQxwjQxwjQxwjQxwjQxwjQxwjQxwjQxwjQxwjQxwjQ.', 'SITE_INCHARGE', true)
ON CONFLICT (email) DO NOTHING;

-- Assign users to sites
INSERT INTO user_site_assignments (user_id, site_id) VALUES 
('550e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440001'), -- John Foreman -> Construction Site Alpha
('550e8400-e29b-41d4-a716-446655440012', '550e8400-e29b-41d4-a716-446655440001'), -- Sarah Supervisor -> Construction Site Alpha
('550e8400-e29b-41d4-a716-446655440013', '550e8400-e29b-41d4-a716-446655440002'), -- Mike Manager -> Agricultural Farm Beta
('550e8400-e29b-41d4-a716-446655440014', '550e8400-e29b-41d4-a716-446655440002'), -- Lisa Leader -> Agricultural Farm Beta
('550e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440003'), -- John Foreman -> Industrial Site Gamma
('550e8400-e29b-41d4-a716-446655440014', '550e8400-e29b-41d4-a716-446655440003')  -- Lisa Leader -> Industrial Site Gamma
ON CONFLICT (user_id, site_id) DO NOTHING;

-- Insert sample workers
INSERT INTO workers (id, name, father_name, adhar_number_encrypted, phone_number, site_id, is_active) VALUES 
-- Workers for Construction Site Alpha
('550e8400-e29b-41d4-a716-446655440021', 'Rajesh Kumar', 'Suresh Kumar', pgp_sym_encrypt('123456789012', 'hajiri_encryption_key'), '+9876543210', '550e8400-e29b-41d4-a716-446655440001', true),
('550e8400-e29b-41d4-a716-446655440022', 'Amit Singh', 'Ramesh Singh', pgp_sym_encrypt('123456789013', 'hajiri_encryption_key'), '+9876543211', '550e8400-e29b-41d4-a716-446655440001', true),
('550e8400-e29b-41d4-a716-446655440023', 'Priya Sharma', 'Mohan Sharma', pgp_sym_encrypt('123456789014', 'hajiri_encryption_key'), '+9876543212', '550e8400-e29b-41d4-a716-446655440001', true),
('550e8400-e29b-41d4-a716-446655440024', 'Vikram Patel', 'Kiran Patel', pgp_sym_encrypt('123456789015', 'hajiri_encryption_key'), '+9876543213', '550e8400-e29b-41d4-a716-446655440001', true),
('550e8400-e29b-41d4-a716-446655440025', 'Sunita Devi', 'Ram Lal', pgp_sym_encrypt('123456789016', 'hajiri_encryption_key'), '+9876543214', '550e8400-e29b-41d4-a716-446655440001', true),

-- Workers for Agricultural Farm Beta
('550e8400-e29b-41d4-a716-446655440026', 'Ravi Yadav', 'Shyam Yadav', pgp_sym_encrypt('123456789017', 'hajiri_encryption_key'), '+9876543215', '550e8400-e29b-41d4-a716-446655440002', true),
('550e8400-e29b-41d4-a716-446655440027', 'Geeta Kumari', 'Hari Prasad', pgp_sym_encrypt('123456789018', 'hajiri_encryption_key'), '+9876543216', '550e8400-e29b-41d4-a716-446655440002', true),
('550e8400-e29b-41d4-a716-446655440028', 'Manoj Gupta', 'Raj Kumar Gupta', pgp_sym_encrypt('123456789019', 'hajiri_encryption_key'), '+9876543217', '550e8400-e29b-41d4-a716-446655440002', true),

-- Workers for Industrial Site Gamma
('550e8400-e29b-41d4-a716-446655440029', 'Deepak Verma', 'Ashok Verma', pgp_sym_encrypt('123456789020', 'hajiri_encryption_key'), '+9876543218', '550e8400-e29b-41d4-a716-446655440003', true),
('550e8400-e29b-41d4-a716-446655440030', 'Kavita Joshi', 'Prakash Joshi', pgp_sym_encrypt('123456789021', 'hajiri_encryption_key'), '+9876543219', '550e8400-e29b-41d4-a716-446655440003', true)
ON CONFLICT (id) DO NOTHING;

-- Insert sample attendance records (last 7 days)
INSERT INTO attendance_records (
  site_id, worker_id, date, status, x_value, y_value, calculated_hours, 
  submitted_by, submitted_at, submitted_to_incharge, verified
) VALUES 
-- Construction Site Alpha - Recent attendance
('550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440021', CURRENT_DATE - INTERVAL '1 day', 'PRESENT', 1, 0, 8.0, '550e8400-e29b-41d4-a716-446655440011', CURRENT_TIMESTAMP - INTERVAL '1 day', true, false),
('550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440022', CURRENT_DATE - INTERVAL '1 day', 'PRESENT', 1, 2, 10.0, '550e8400-e29b-41d4-a716-446655440011', CURRENT_TIMESTAMP - INTERVAL '1 day', true, false),
('550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440023', CURRENT_DATE - INTERVAL '1 day', 'ABSENT', 0, 0, 0.0, '550e8400-e29b-41d4-a716-446655440011', CURRENT_TIMESTAMP - INTERVAL '1 day', true, false),
('550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440024', CURRENT_DATE - INTERVAL '1 day', 'PRESENT', 1, 1, 9.0, '550e8400-e29b-41d4-a716-446655440011', CURRENT_TIMESTAMP - INTERVAL '1 day', true, false),

-- Agricultural Farm Beta - Recent attendance (half-day mode)
('550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440026', CURRENT_DATE - INTERVAL '1 day', 'PRESENT', 1, 1, 15.0, '550e8400-e29b-41d4-a716-446655440013', CURRENT_TIMESTAMP - INTERVAL '1 day', true, true),
('550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440027', CURRENT_DATE - INTERVAL '1 day', 'PRESENT', 0, 2, 10.0, '550e8400-e29b-41d4-a716-446655440013', CURRENT_TIMESTAMP - INTERVAL '1 day', true, true),

-- Industrial Site Gamma - Recent attendance
('550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440029', CURRENT_DATE - INTERVAL '1 day', 'PRESENT', 1, 0, 8.0, '550e8400-e29b-41d4-a716-446655440011', CURRENT_TIMESTAMP - INTERVAL '1 day', true, false),
('550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440030', CURRENT_DATE - INTERVAL '1 day', 'PRESENT', 1, 3, 11.0, '550e8400-e29b-41d4-a716-446655440011', CURRENT_TIMESTAMP - INTERVAL '1 day', true, false)
ON CONFLICT (worker_id, date) DO NOTHING;

-- Update approved records with approval information
UPDATE attendance_records 
SET 
  approved_by = '550e8400-e29b-41d4-a716-446655440014',
  approved_at = CURRENT_TIMESTAMP - INTERVAL '2 hours'
WHERE site_id = '550e8400-e29b-41d4-a716-446655440002' AND verified = true;

-- Insert sample audit logs
INSERT INTO audit_logs (entity_type, entity_id, action, changed_by, old_values, new_values, metadata) VALUES 
('attendance_records', '550e8400-e29b-41d4-a716-446655440026', 'APPROVE', '550e8400-e29b-41d4-a716-446655440014', 
 '{"verified": false}', '{"verified": true, "approved_by": "550e8400-e29b-41d4-a716-446655440014"}', 
 '{"approval_notes": "Approved after verification"}'),
('workers', '550e8400-e29b-41d4-a716-446655440021', 'CREATE', '550e8400-e29b-41d4-a716-446655440011', 
 null, '{"name": "Rajesh Kumar", "father_name": "Suresh Kumar", "site_id": "550e8400-e29b-41d4-a716-446655440001"}', 
 '{"created_via": "seed_data"}');

COMMENT ON TABLE schema_migrations IS 'Tracks applied database migrations';