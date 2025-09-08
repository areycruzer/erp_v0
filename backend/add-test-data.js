const { NewAttendanceRepository } = require('./dist/repositories/NewAttendanceRepository.js');
const { WorkerRepository } = require('./dist/repositories/WorkerRepository.js');
const { SiteRepository } = require('./dist/repositories/SiteRepository.js');
const { UserRepository } = require('./dist/repositories/UserRepository.js');

async function addTestData() {
  try {
    console.log('🧪 Adding test attendance data...');
    
    // Get first worker, site, and user
    const workers = await WorkerRepository.findAll({ limit: 1 });
    const sites = await SiteRepository.findAll();
    const users = await UserRepository.findAll({ limit: 1 });
    
    if (workers.workers.length === 0 || sites.length === 0 || users.users.length === 0) {
      console.log('❌ Need at least one worker, site, and user to create test data');
      return;
    }
    
    const worker = workers.workers[0];
    const site = sites[0];
    const user = users.users[0];
    
    console.log(`📝 Creating attendance for worker: ${worker.name} at site: ${site.name}`);
    
    // Create test attendance record
    const attendanceData = {
      worker_id: worker.id,
      site_id: site.id,
      date: new Date().toISOString().split('T')[0], // Today's date
      P: 8.0,
      A: 0.0,
      HD: 0.0,
      interpretation_mode: 'TOTAL_COUNT',
      submitted_by: user.id,
      status: 'PENDING'
    };
    
    const newRecord = await NewAttendanceRepository.create(attendanceData);
    console.log('✅ Test attendance record created:', newRecord);
    
    // Create another record for yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const attendanceData2 = {
      worker_id: worker.id,
      site_id: site.id,
      date: yesterday.toISOString().split('T')[0],
      P: 6.0,
      A: 0.0,
      HD: 2.0,
      interpretation_mode: 'TOTAL_COUNT',
      submitted_by: user.id,
      status: 'PENDING'
    };
    
    const newRecord2 = await NewAttendanceRepository.create(attendanceData2);
    console.log('✅ Second test attendance record created:', newRecord2);
    
  } catch (error) {
    console.error('❌ Error adding test data:', error);
  }
  process.exit(0);
}

addTestData();
