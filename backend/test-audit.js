const { query } = require('./dist/config/database');
const { AuditService } = require('./dist/services/AuditService');

async function testAuditLogging() {
  console.log('🧪 Testing Audit Logging System...\n');

  try {
    // Test context
    const testContext = {
      userId: 'admin-user-id-001', // Use the actual admin user ID
      userRole: 'ADMIN',
      ipAddress: '127.0.0.1',
      userAgent: 'Test-Agent/1.0'
    };

    // 1. Test CREATE audit log
    console.log('1. Creating CREATE audit log...');
    await AuditService.logCreate(
      'new_attendance_records',
      'test-attendance-123',
      testContext,
      {
        worker_id: 1,
        site_id: 1,
        date: '2025-09-08',
        P: 1,
        A: 0,
        HD: 0,
        status: 'PENDING'
      },
      { action_description: 'Test attendance record creation' }
    );
    console.log('✅ CREATE audit log created');

    // 2. Test UPDATE audit log
    console.log('\n2. Creating UPDATE audit log...');
    await AuditService.logUpdate(
      'new_attendance_records',
      'test-attendance-123',
      testContext,
      {
        P: 1,
        A: 0,
        HD: 0,
        status: 'PENDING'
      },
      {
        P: 0,
        A: 1,
        HD: 0,
        status: 'PENDING'
      },
      { action_description: 'Test attendance record update' }
    );
    console.log('✅ UPDATE audit log created');

    // 3. Test APPROVE audit log
    console.log('\n3. Creating APPROVE audit log...');
    await AuditService.logApprove(
      'new_attendance_records',
      'test-attendance-123',
      testContext,
      {
        P: 0,
        A: 1,
        HD: 0,
        status: 'PENDING'
      },
      {
        P: 0,
        A: 1,
        HD: 0,
        status: 'APPROVED'
      },
      { action_description: 'Test attendance record approval' }
    );
    console.log('✅ APPROVE audit log created');

    // 4. Query recent audit logs
    console.log('\n4. Querying recent audit logs...');
    const auditLogs = await query(`
      SELECT 
        al.*,
        u.name as user_name
      FROM audit_logs al
      LEFT JOIN users u ON al.changed_by = u.id
      ORDER BY al.timestamp DESC
      LIMIT 10
    `, []);

    console.log(`\n📊 Found ${auditLogs.length} recent audit logs:`);
    auditLogs.forEach((log, index) => {
      console.log(`\n${index + 1}. ${log.action} on ${log.entity_type}`);
      console.log(`   ID: ${log.id}`);
      console.log(`   Entity ID: ${log.entity_id}`);
      console.log(`   User: ${log.user_name || log.changed_by}`);
      console.log(`   Time: ${log.timestamp}`);
      
      if (log.old_values) {
        console.log(`   Old Values: ${log.old_values}`);
      }
      if (log.new_values) {
        console.log(`   New Values: ${log.new_values}`);
      }
      if (log.metadata) {
        console.log(`   Metadata: ${log.metadata}`);
      }
    });

    // 5. Test system audit logs method
    console.log('\n5. Testing system audit logs method...');
    const systemLogs = await AuditService.getSystemAuditLogs({
      entity_type: 'new_attendance_records',
      limit: 5
    });
    console.log(`✅ Retrieved ${systemLogs.logs.length} system logs, total: ${systemLogs.total}`);

    console.log('\n🎉 Audit logging test completed successfully!');
    
  } catch (error) {
    console.error('❌ Audit logging test failed:', error);
  }
}

// Run the test
testAuditLogging().then(() => {
  console.log('\n✅ Test script completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Test script failed:', error);
  process.exit(1);
});
