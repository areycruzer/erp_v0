import { query } from '../config/database';

async function listTables() {
  try {
    console.log('🔍 Listing all tables in the database...');
    
    const tables = await query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    console.log('Tables found:', tables);
    
    console.log('\n📋 Migration status:');
    const migrations = await query('SELECT * FROM schema_migrations ORDER BY version');
    console.log('Applied migrations:', migrations);
    
  } catch (error) {
    console.error('❌ Failed to list tables:', error);
  }
  
  process.exit(0);
}

listTables();
