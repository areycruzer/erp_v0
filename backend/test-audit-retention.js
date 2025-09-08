const { AuditRetentionService } = require('./dist/services/AuditRetentionService');

async function testAuditRetention() {
  console.log('🧪 Testing Audit Retention Service...\n');

  try {
    // 1. Get retention statistics
    console.log('1. Getting retention statistics...');
    const stats = await AuditRetentionService.getRetentionStatistics();
    
    console.log('📊 Current Statistics:');
    console.log(`   Total logs: ${stats.totalLogs}`);
    console.log(`   Oldest log: ${stats.oldestLog ? stats.oldestLog.toISOString() : 'None'}`);
    console.log(`   Newest log: ${stats.newestLog ? stats.newestLog.toISOString() : 'None'}`);
    console.log(`   Estimated disk usage: ${stats.estimatedDiskUsage}`);
    
    console.log('\n📈 Logs by age:');
    stats.logsByAge.forEach(group => {
      console.log(`   Older than ${group.days} days: ${group.count} logs`);
    });

    // 2. Test cleanup with a very high retention period (so nothing gets deleted)
    console.log('\n2. Testing cleanup (dry run with high retention)...');
    const cleanupResult = await AuditRetentionService.cleanupOldLogs({
      retentionDays: 3650, // 10 years - should delete nothing
      enableArchiving: false,
      batchSize: 100
    });

    console.log('🧹 Cleanup Results:');
    console.log(`   Deleted: ${cleanupResult.deletedCount} logs`);
    console.log(`   Archived: ${cleanupResult.archivedCount} logs`);
    console.log(`   Errors: ${cleanupResult.errors.length}`);
    
    if (cleanupResult.errors.length > 0) {
      console.log('   Error details:', cleanupResult.errors);
    }

    console.log('\n🎉 Audit retention test completed successfully!');
    
  } catch (error) {
    console.error('❌ Audit retention test failed:', error);
  }
}

// Run the test
testAuditRetention().then(() => {
  console.log('\n✅ Test script completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Test script failed:', error);
  process.exit(1);
});
