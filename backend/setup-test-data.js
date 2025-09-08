const { UserRepository } = require('./dist/repositories/UserRepository.js');
const { SiteRepository } = require('./dist/repositories/SiteRepository.js'); 
const { WorkerRepository } = require('./dist/repositories/WorkerRepository.js');
const { NewAttendanceRepository } = require('./dist/repositories/NewAttendanceRepository.js');
const bcrypt = require('bcrypt');

async function setupTestData() {
  try {
    console.log('🔍 Checking existing data...');
    
    // Check users
    const existingUsers = await UserRepository.findAll({ limit: 5 });
    console.log('👥 Existing users:', existingUsers.users?.length || 0);
    
    let testUser;
    if (!existingUsers.users || existingUsers.users.length === 0) {
      console.log('🆕 Creating test user...');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      testUser = await UserRepository.create({
        name: 'Test Admin',
        email: 'admin@test.com',
        password_hash: hashedPassword,
        role: 'ADMIN',
        is_active: true
      });
      console.log('✅ Test user created:', testUser.name);
    } else {
      testUser = existingUsers.users[0];
      console.log('✅ Using existing user:', testUser.name);
    }
    
    // Check sites
    const existingSites = await SiteRepository.findAll();
    console.log('🏗️ Existing sites:', existingSites?.length || 0);
    
    let testSite;
    if (!existingSites || existingSites.length === 0) {
      console.log('🆕 Creating test site...');
      testSite = await SiteRepository.create({
        name: 'Test Construction Site',
        location: 'Mumbai, India',
        full_day_hours: 8.0,
        interpretation_mode: 'HOURS',
        checkpoint_time: '09:00:00',
        timezone: 'Asia/Kolkata'
      });
      console.log('✅ Test site created:', testSite.name);
    } else {
      testSite = existingSites[0];
      console.log('✅ Using existing site:', testSite.name);
    }
    
    // Check workers
    const existingWorkers = await WorkerRepository.findAll({ limit: 5 });
    console.log('👷 Existing workers:', existingWorkers.workers?.length || 0);
    
    let testWorker;
    if (!existingWorkers.workers || existingWorkers.workers.length === 0) {
      console.log('🆕 Creating test worker...');
      testWorker = await WorkerRepository.create({
        name: 'Rajesh Kumar',
        father_name: 'Ram Kumar',
        adhar_number_encrypted: '1234-5678-9012',
        phone_number: '+91-9876543210',
        site_id: testSite.id,
        is_active: true
      });
      console.log('✅ Test worker created:', testWorker.name);
    } else {
      testWorker = existingWorkers.workers[0];
      console.log('✅ Using existing worker:', testWorker.name);
    }
    
    // Create attendance records
    console.log('📝 Creating test attendance records...');
    
    // Today's attendance
    const todayRecord = await NewAttendanceRepository.create({
      worker_id: testWorker.id,
      site_id: testSite.id,
      date: new Date().toISOString().split('T')[0],
      P: 8.0,
      A: 0.0,
      HD: 0.0,
      interpretation_mode: 'TOTAL_COUNT',
      submitted_by: testUser.id,
      status: 'PENDING'
    });
    console.log('✅ Today attendance record created');
    
    // Yesterday's attendance
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const yesterdayRecord = await NewAttendanceRepository.create({
      worker_id: testWorker.id,
      site_id: testSite.id,
      date: yesterday.toISOString().split('T')[0],
      P: 6.0,
      A: 0.0,
      HD: 2.0,
      interpretation_mode: 'TOTAL_COUNT',
      submitted_by: testUser.id,
      status: 'PENDING'
    });
    console.log('✅ Yesterday attendance record created');
    
    console.log('🎉 Test data setup complete!');
    console.log('📊 Summary:');
    console.log(`   User: ${testUser.name} (${testUser.email})`);
    console.log(`   Site: ${testSite.name}`);
    console.log(`   Worker: ${testWorker.name}`);
    console.log('   Attendance: 2 records created');
    
  } catch (error) {
    console.error('❌ Error setting up test data:', error);
  }
  process.exit(0);
}

setupTestData();
