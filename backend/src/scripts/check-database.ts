import { query } from '../config/database';

async function checkDatabase() {
  try {
    console.log('🔍 Checking database tables and data...');
    
    // Check if sites table exists and has data
    console.log('\n📊 Sites table:');
    const sites = await query('SELECT * FROM sites ORDER BY name');
    console.log(`Found ${sites.length} sites:`, sites);
    
    // Check if users table has data
    console.log('\n👥 Users table:');
    const users = await query('SELECT id, name, email, role FROM users');
    console.log(`Found ${users.length} users:`, users);
    
    // Check if workers table exists and has data
    console.log('\n👷 Workers table:');
    const workers = await query('SELECT * FROM workers LIMIT 5');
    console.log(`Found ${workers.length} workers:`, workers);
    
    console.log('\n✅ Database check completed');
    
  } catch (error) {
    console.error('❌ Database check failed:', error);
  }
  
  process.exit(0);
}

checkDatabase();
