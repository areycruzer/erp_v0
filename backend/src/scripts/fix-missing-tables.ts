import { query } from '../config/database';

async function fixMissingTables() {
  try {
    console.log('🔧 Creating missing tables...');
    
    // Create sites table
    console.log('Creating sites table...');
    await query(`
      CREATE TABLE IF NOT EXISTS sites (
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
      )
    `);
    
    // Create workers table
    console.log('Creating workers table...');
    await query(`
      CREATE TABLE IF NOT EXISTS workers (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        name TEXT NOT NULL,
        father_name TEXT NOT NULL,
        adhar_number_encrypted TEXT,
        phone_number TEXT,
        site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create user_site_assignments table
    console.log('Creating user_site_assignments table...');
    await query(`
      CREATE TABLE IF NOT EXISTS user_site_assignments (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, site_id)
      )
    `);
    
    // Create attendance_records table
    console.log('Creating attendance_records table...');
    await query(`
      CREATE TABLE IF NOT EXISTS attendance_records (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        worker_id TEXT NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
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
      )
    `);
    
    // Create audit_logs table
    console.log('Creating audit_logs table...');
    await query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        action TEXT NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'APPROVE')),
        changed_by TEXT NOT NULL REFERENCES users(id),
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        old_values TEXT,
        new_values TEXT,
        metadata TEXT
      )
    `);
    
    console.log('✅ All tables created successfully');
    
    // Now add the seed data
    console.log('🌱 Adding seed data...');
    
    // Insert sites
    await query(`
      INSERT OR IGNORE INTO sites (id, name, location, notes, full_day_hours, interpretation_mode, checkpoint_time, timezone) VALUES 
      ('site-construction-001', 'Construction Site Alpha', 'Downtown Construction Zone', 'Main construction project', 8, 'HOURS', '08:00:00', 'UTC'),
      ('site-agricultural-002', 'Agricultural Farm Beta', 'Rural Farm Area', 'Seasonal agricultural work', 10, 'HALF_DAYS', '06:00:00', 'UTC'),
      ('site-industrial-003', 'Industrial Site Gamma', 'Industrial District', 'Manufacturing facility', 8, 'HOURS', '07:30:00', 'UTC')
    `);
    
    // Insert workers
    await query(`
      INSERT OR IGNORE INTO workers (id, name, father_name, adhar_number_encrypted, phone_number, site_id, is_active) VALUES 
      ('worker-construction-001', 'Rajesh Kumar', 'Suresh Kumar', NULL, '+9876543210', 'site-construction-001', 1),
      ('worker-construction-002', 'Amit Singh', 'Ramesh Singh', NULL, '+9876543211', 'site-construction-001', 1),
      ('worker-agricultural-001', 'Ravi Yadav', 'Shyam Yadav', NULL, '+9876543215', 'site-agricultural-002', 1),
      ('worker-industrial-001', 'Deepak Verma', 'Ashok Verma', NULL, '+9876543218', 'site-industrial-003', 1)
    `);
    
    console.log('✅ Seed data added successfully');
    
    // Verify the tables
    const tables = await query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    console.log('Tables now in database:', tables.map((t: any) => t.name));
    
  } catch (error) {
    console.error('❌ Failed to fix tables:', error);
  }
  
  process.exit(0);
}

fixMissingTables();
