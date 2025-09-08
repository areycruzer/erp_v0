const { query } = require('./dist/config/database.js');

async function createTrigger() {
  try {
    const sql = `CREATE TRIGGER IF NOT EXISTS update_new_attendance_updated_at
      AFTER UPDATE ON new_attendance_records
      FOR EACH ROW
    BEGIN
      UPDATE new_attendance_records 
      SET updated_at = CURRENT_TIMESTAMP 
      WHERE id = NEW.id;
    END;`;
    
    await query(sql);
    console.log('✅ Trigger created successfully!');
  } catch (error) {
    console.error('❌ Trigger creation failed:', error);
  }
  process.exit(0);
}

createTrigger();
