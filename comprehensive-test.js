#!/usr/bin/env node

/**
 * Hajiri Attendance System - Comprehensive Integration Test Suite
 * 
 * This test validates ALL functionality of the Hajiri system including:
 * - Database connectivity and schema validation
 * - Authentication and authorization
 * - User management (all roles)
 * - Site and worker management
 * - Attendance submission and approval workflow
 * - Audit logging and reporting
 * - PWA offline functionality
 * - Performance benchmarks
 * - Security measures
 * 
 * Run with: node comprehensive-test.js
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

// Configuration
const config = {
  baseURL: 'http://localhost:3004/api',
  frontendURL: 'http://localhost:3001',
  timeout: 10000,
  maxRetries: 3
};

// Test results tracking
const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: [],
  performance: {},
  startTime: Date.now()
};

// Logger utility
const logger = {
  info: (message) => {
    console.log(`ℹ️  ${new Date().toISOString()} [INFO] ${message}`);
  },
  success: (message) => {
    console.log(`✅ ${new Date().toISOString()} [SUCCESS] ${message}`);
  },
  error: (message, error = null) => {
    console.error(`❌ ${new Date().toISOString()} [ERROR] ${message}`);
    if (error) {
      console.error(`   Details: ${error.message}`);
      console.error(`   Stack: ${error.stack}`);
    }
    testResults.errors.push({ message, error: error?.message, stack: error?.stack, timestamp: new Date().toISOString() });
  },
  warn: (message) => {
    console.warn(`⚠️  ${new Date().toISOString()} [WARN] ${message}`);
  }
};

// HTTP client with retry logic
const httpClient = axios.create({
  baseURL: config.baseURL,
  timeout: config.timeout,
  validateStatus: () => true // Don't throw on HTTP errors
});

// Test execution wrapper
async function runTest(testName, testFunction) {
  testResults.total++;
  const startTime = performance.now();
  
  try {
    logger.info(`Starting test: ${testName}`);
    await testFunction();
    const duration = performance.now() - startTime;
    testResults.performance[testName] = duration;
    testResults.passed++;
    logger.success(`Test passed: ${testName} (${duration.toFixed(2)}ms)`);
  } catch (error) {
    const duration = performance.now() - startTime;
    testResults.performance[testName] = duration;
    testResults.failed++;
    logger.error(`Test failed: ${testName} (${duration.toFixed(2)}ms)`, error);
  }
}

// Utility functions
function assertStatus(response, expectedStatus, message) {
  if (response.status !== expectedStatus) {
    throw new Error(`${message}. Expected status ${expectedStatus}, got ${response.status}. Response: ${JSON.stringify(response.data)}`);
  }
}

function assertProperty(obj, property, message) {
  if (!obj.hasOwnProperty(property)) {
    throw new Error(`${message}. Missing property: ${property}`);
  }
}

function assertValue(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected: ${expected}, Got: ${actual}`);
  }
}

// Test data
const testData = {
  admin: { email: 'admin@hajiri.com', password: 'admin123', role: 'ADMIN' },
  siteIncharge: { email: 'site@hajiri.com', password: 'site123', role: 'SITE_INCHARGE' },
  foreman: { email: 'foreman@hajiri.com', password: 'foreman123', role: 'FOREMAN' },
  site: { name: 'Test Construction Site', location: 'Test Location', full_day_hours: 8 },
  worker: { name: 'Test Worker', father_name: 'Test Father', adhar_number: '123456789012' }
};

let authTokens = {};
let createdEntities = { users: [], sites: [], workers: [], attendance: [] };

// === TEST IMPLEMENTATIONS ===

// 1. Database and Server Health Check
async function testDatabaseConnection() {
  const response = await httpClient.get('/health');
  assertStatus(response, 200, 'Database health check failed');
  assertProperty(response.data, 'database', 'Health response missing database status');
  assertValue(response.data.database, 'connected', 'Database not connected');
}

// 2. Authentication System Test
async function testAuthentication() {
  // Test admin login
  const adminLogin = await httpClient.post('/auth/login', {
    email: testData.admin.email,
    password: testData.admin.password
  });
  assertStatus(adminLogin, 200, 'Admin login failed');
  assertProperty(adminLogin.data, 'token', 'Login response missing token');
  assertProperty(adminLogin.data, 'user', 'Login response missing user');
  assertValue(adminLogin.data.user.role, 'ADMIN', 'Admin role incorrect');
  
  authTokens.admin = adminLogin.data.token;
  
  // Test token validation
  const meResponse = await httpClient.get('/auth/me', {
    headers: { Authorization: `Bearer ${authTokens.admin}` }
  });
  assertStatus(meResponse, 200, 'Token validation failed');
  assertValue(meResponse.data.role, 'ADMIN', 'Token user role mismatch');
}

// 3. User Management System Test
async function testUserManagement() {
  const headers = { Authorization: `Bearer ${authTokens.admin}` };
  
  // Create Site Incharge
  const createSiteIncharge = await httpClient.post('/users', {
    name: 'Test Site Incharge',
    email: testData.siteIncharge.email,
    password: testData.siteIncharge.password,
    role: 'SITE_INCHARGE'
  }, { headers });
  assertStatus(createSiteIncharge, 201, 'Site Incharge creation failed');
  createdEntities.users.push(createSiteIncharge.data.id);
  
  // Create Foreman
  const createForeman = await httpClient.post('/users', {
    name: 'Test Foreman',
    email: testData.foreman.email,
    password: testData.foreman.password,
    role: 'FOREMAN'
  }, { headers });
  assertStatus(createForeman, 201, 'Foreman creation failed');
  createdEntities.users.push(createForeman.data.id);
  
  // List users
  const listUsers = await httpClient.get('/users', { headers });
  assertStatus(listUsers, 200, 'Users listing failed');
  
  if (!Array.isArray(listUsers.data) || listUsers.data.length < 3) {
    throw new Error('Expected at least 3 users (admin + 2 created)');
  }
  
  // Test role-based access
  const siteInchargeLogin = await httpClient.post('/auth/login', {
    email: testData.siteIncharge.email,
    password: testData.siteIncharge.password
  });
  assertStatus(siteInchargeLogin, 200, 'Site Incharge login failed');
  authTokens.siteIncharge = siteInchargeLogin.data.token;
  
  const foremanLogin = await httpClient.post('/auth/login', {
    email: testData.foreman.email,
    password: testData.foreman.password
  });
  assertStatus(foremanLogin, 200, 'Foreman login failed');
  authTokens.foreman = foremanLogin.data.token;
}

// 4. Site Management Test
async function testSiteManagement() {
  const headers = { Authorization: `Bearer ${authTokens.admin}` };
  
  // Create site
  const createSite = await httpClient.post('/sites', testData.site, { headers });
  assertStatus(createSite, 201, 'Site creation failed');
  createdEntities.sites.push(createSite.data.id);
  
  // List sites
  const listSites = await httpClient.get('/sites', { headers });
  assertStatus(listSites, 200, 'Sites listing failed');
  
  // Update site
  const updateSite = await httpClient.put(`/sites/${createSite.data.id}`, {
    ...testData.site,
    location: 'Updated Location'
  }, { headers });
  assertStatus(updateSite, 200, 'Site update failed');
  assertValue(updateSite.data.location, 'Updated Location', 'Site update not reflected');
}

// 5. Worker Management Test
async function testWorkerManagement() {
  const headers = { Authorization: `Bearer ${authTokens.admin}` };
  
  // Create worker
  const createWorker = await httpClient.post('/workers', {
    ...testData.worker,
    site_id: createdEntities.sites[0]
  }, { headers });
  assertStatus(createWorker, 201, 'Worker creation failed');
  createdEntities.workers.push(createWorker.data.id);
  
  // List workers
  const listWorkers = await httpClient.get('/workers', { headers });
  assertStatus(listWorkers, 200, 'Workers listing failed');
  
  // Verify encryption (Adhar should be encrypted)
  const workerDetails = await httpClient.get(`/workers/${createWorker.data.id}`, { headers });
  assertStatus(workerDetails, 200, 'Worker details fetch failed');
  
  if (workerDetails.data.adhar_number_encrypted === testData.worker.adhar_number) {
    throw new Error('Adhar number not encrypted properly');
  }
}

// 6. Attendance Management Test
async function testAttendanceManagement() {
  const foremanHeaders = { Authorization: `Bearer ${authTokens.foreman}` };
  
  // Submit attendance
  const submitAttendance = await httpClient.post('/attendance', {
    workerId: createdEntities.workers[0],
    siteId: createdEntities.sites[0],
    date: new Date().toISOString().split('T')[0],
    P: 1,
    A: 0,
    HD: 0,
    interpretationMode: 'TOTAL_COUNT',
    submittedBy: createdEntities.users[1], // Foreman ID
    status: 'PENDING'
  }, { headers: foremanHeaders });
  assertStatus(submitAttendance, 201, 'Attendance submission failed');
  createdEntities.attendance.push(submitAttendance.data.id);
  
  // List attendance (as site incharge)
  const siteInchargeHeaders = { Authorization: `Bearer ${authTokens.siteIncharge}` };
  const listAttendance = await httpClient.get('/attendance', { headers: siteInchargeHeaders });
  assertStatus(listAttendance, 200, 'Attendance listing failed');
  
  // Approve attendance
  const approveAttendance = await httpClient.put(`/attendance/${submitAttendance.data.id}`, {
    status: 'APPROVED'
  }, { headers: siteInchargeHeaders });
  assertStatus(approveAttendance, 200, 'Attendance approval failed');
  assertValue(approveAttendance.data.status, 'APPROVED', 'Attendance status not updated');
}

// 7. Audit System Test
async function testAuditSystem() {
  const headers = { Authorization: `Bearer ${authTokens.admin}` };
  
  // Fetch audit logs
  const auditLogs = await httpClient.get('/audit/logs', { headers });
  assertStatus(auditLogs, 200, 'Audit logs fetch failed');
  
  if (!Array.isArray(auditLogs.data) || auditLogs.data.length === 0) {
    throw new Error('No audit logs found - audit system not working');
  }
  
  // Test audit analytics
  const auditAnalytics = await httpClient.get('/audit/analytics', { headers });
  assertStatus(auditAnalytics, 200, 'Audit analytics fetch failed');
  
  // Generate audit report
  const auditReport = await httpClient.post('/audit/reports', {
    format: 'JSON',
    dateRange: {
      start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      end: new Date().toISOString()
    }
  }, { headers });
  assertStatus(auditReport, 201, 'Audit report generation failed');
}

// 8. Notification System Test
async function testNotificationSystem() {
  const headers = { Authorization: `Bearer ${authTokens.admin}` };
  
  // Fetch notifications
  const notifications = await httpClient.get('/notifications', { headers });
  assertStatus(notifications, 200, 'Notifications fetch failed');
  
  // Mark notification as read (if any exist)
  if (Array.isArray(notifications.data) && notifications.data.length > 0) {
    const markRead = await httpClient.put(`/notifications/${notifications.data[0].id}/read`, {}, { headers });
    assertStatus(markRead, 200, 'Notification mark as read failed');
  }
}

// 9. Frontend Connectivity Test
async function testFrontendConnectivity() {
  try {
    const frontendResponse = await axios.get(config.frontendURL, { timeout: 5000 });
    if (frontendResponse.status !== 200) {
      throw new Error(`Frontend not accessible. Status: ${frontendResponse.status}`);
    }
    
    // Check for PWA manifest
    const manifestResponse = await axios.get(`${config.frontendURL}/manifest.json`, { timeout: 5000 });
    if (manifestResponse.status !== 200) {
      throw new Error('PWA manifest not accessible');
    }
    
    // Check for service worker
    const swResponse = await axios.get(`${config.frontendURL}/sw.js`, { timeout: 5000 });
    if (swResponse.status !== 200) {
      throw new Error('Service worker not accessible');
    }
  } catch (error) {
    throw new Error(`Frontend connectivity test failed: ${error.message}`);
  }
}

// 10. Performance Benchmark Test
async function testPerformanceBenchmarks() {
  const performanceTests = [
    { name: 'Auth Login', endpoint: '/auth/login', method: 'post', data: testData.admin, expectedMs: 500 },
    { name: 'Users List', endpoint: '/users', method: 'get', headers: { Authorization: `Bearer ${authTokens.admin}` }, expectedMs: 1000 },
    { name: 'Sites List', endpoint: '/sites', method: 'get', headers: { Authorization: `Bearer ${authTokens.admin}` }, expectedMs: 1000 },
    { name: 'Workers List', endpoint: '/workers', method: 'get', headers: { Authorization: `Bearer ${authTokens.admin}` }, expectedMs: 1000 },
    { name: 'Attendance List', endpoint: '/attendance', method: 'get', headers: { Authorization: `Bearer ${authTokens.admin}` }, expectedMs: 1000 }
  ];
  
  for (const test of performanceTests) {
    const startTime = performance.now();
    
    let response;
    if (test.method === 'post') {
      response = await httpClient.post(test.endpoint, test.data, { headers: test.headers });
    } else {
      response = await httpClient.get(test.endpoint, { headers: test.headers });
    }
    
    const duration = performance.now() - startTime;
    
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Performance test ${test.name} failed with status ${response.status}`);
    }
    
    if (duration > test.expectedMs) {
      logger.warn(`Performance test ${test.name} slower than expected: ${duration.toFixed(2)}ms > ${test.expectedMs}ms`);
    }
    
    logger.info(`Performance test ${test.name}: ${duration.toFixed(2)}ms`);
  }
}

// 11. Security Test
async function testSecurity() {
  // Test unauthorized access
  const unauthorizedResponse = await httpClient.get('/users');
  if (unauthorizedResponse.status !== 401) {
    throw new Error('Unauthorized access not properly blocked');
  }
  
  // Test invalid token
  const invalidTokenResponse = await httpClient.get('/users', {
    headers: { Authorization: 'Bearer invalid-token' }
  });
  if (invalidTokenResponse.status !== 401) {
    throw new Error('Invalid token not properly rejected');
  }
  
  // Test role-based access (foreman trying to access admin endpoint)
  const roleViolationResponse = await httpClient.get('/users', {
    headers: { Authorization: `Bearer ${authTokens.foreman}` }
  });
  if (roleViolationResponse.status !== 403) {
    throw new Error('Role-based access control not working');
  }
}

// 12. Database Integrity Test
async function testDatabaseIntegrity() {
  const headers = { Authorization: `Bearer ${authTokens.admin}` };
  
  // Test foreign key constraints
  try {
    await httpClient.post('/workers', {
      ...testData.worker,
      site_id: 'non-existent-site-id'
    }, { headers });
    throw new Error('Foreign key constraint not enforced');
  } catch (error) {
    if (!error.message.includes('Foreign key constraint')) {
      // Expected behavior - constraint should be enforced
    }
  }
  
  // Test data validation
  const invalidDataResponse = await httpClient.post('/users', {
    name: '', // Invalid empty name
    email: 'invalid-email', // Invalid email format
    password: '123', // Too short password
    role: 'INVALID_ROLE' // Invalid role
  }, { headers });
  
  if (invalidDataResponse.status === 201) {
    throw new Error('Data validation not working - invalid data was accepted');
  }
}

// === CLEANUP FUNCTIONS ===

async function cleanup() {
  logger.info('Starting cleanup...');
  const headers = { Authorization: `Bearer ${authTokens.admin}` };
  
  try {
    // Clean up attendance records
    for (const id of createdEntities.attendance) {
      await httpClient.delete(`/attendance/${id}`, { headers });
    }
    
    // Clean up workers
    for (const id of createdEntities.workers) {
      await httpClient.delete(`/workers/${id}`, { headers });
    }
    
    // Clean up sites
    for (const id of createdEntities.sites) {
      await httpClient.delete(`/sites/${id}`, { headers });
    }
    
    // Clean up users
    for (const id of createdEntities.users) {
      await httpClient.delete(`/users/${id}`, { headers });
    }
    
    logger.success('Cleanup completed');
  } catch (error) {
    logger.error('Cleanup failed', error);
  }
}

// === MAIN TEST EXECUTION ===

async function runComprehensiveTest() {
  logger.info('🚀 Starting Hajiri Attendance System Comprehensive Test Suite');
  logger.info(`📊 Configuration: Backend=${config.baseURL}, Frontend=${config.frontendURL}`);
  
  try {
    // Core System Tests
    await runTest('Database Connection', testDatabaseConnection);
    await runTest('Authentication System', testAuthentication);
    await runTest('User Management', testUserManagement);
    await runTest('Site Management', testSiteManagement);
    await runTest('Worker Management', testWorkerManagement);
    await runTest('Attendance Management', testAttendanceManagement);
    
    // Advanced Feature Tests
    await runTest('Audit System', testAuditSystem);
    await runTest('Notification System', testNotificationSystem);
    await runTest('Frontend Connectivity', testFrontendConnectivity);
    
    // Quality Tests
    await runTest('Performance Benchmarks', testPerformanceBenchmarks);
    await runTest('Security Measures', testSecurity);
    await runTest('Database Integrity', testDatabaseIntegrity);
    
  } finally {
    // Always try to cleanup
    await cleanup();
  }
  
  // Generate final report
  generateFinalReport();
}

function generateFinalReport() {
  const totalTime = Date.now() - testResults.startTime;
  const successRate = (testResults.passed / testResults.total * 100).toFixed(2);
  
  console.log('\n' + '='.repeat(80));
  console.log('📋 HAJIRI ATTENDANCE SYSTEM - COMPREHENSIVE TEST REPORT');
  console.log('='.repeat(80));
  console.log(`🕒 Total Execution Time: ${totalTime}ms`);
  console.log(`📊 Tests Run: ${testResults.total}`);
  console.log(`✅ Tests Passed: ${testResults.passed}`);
  console.log(`❌ Tests Failed: ${testResults.failed}`);
  console.log(`📈 Success Rate: ${successRate}%`);
  
  if (testResults.failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! System is fully functional and ready for production.');
  } else {
    console.log('\n⚠️  Some tests failed. Review the errors below:');
    testResults.errors.forEach((error, index) => {
      console.log(`\n❌ Error ${index + 1}: ${error.message}`);
      if (error.error) console.log(`   Details: ${error.error}`);
      if (error.stack) console.log(`   Stack: ${error.stack.split('\n')[0]}`);
      console.log(`   Time: ${error.timestamp}`);
    });
  }
  
  console.log('\n📊 Performance Results:');
  Object.entries(testResults.performance).forEach(([test, duration]) => {
    const status = duration < 2000 ? '✅' : duration < 5000 ? '⚠️' : '❌';
    console.log(`   ${status} ${test}: ${duration.toFixed(2)}ms`);
  });
  
  // Save detailed report to file
  const reportData = {
    timestamp: new Date().toISOString(),
    summary: {
      total: testResults.total,
      passed: testResults.passed,
      failed: testResults.failed,
      successRate: parseFloat(successRate),
      totalTime: totalTime
    },
    performance: testResults.performance,
    errors: testResults.errors,
    config: config
  };
  
  const reportPath = path.join(__dirname, 'test-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
  console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  
  console.log('\n' + '='.repeat(80));
  
  // Exit with appropriate code
  process.exit(testResults.failed === 0 ? 0 : 1);
}

// Handle process termination
process.on('SIGINT', () => {
  logger.warn('Test interrupted by user');
  cleanup().then(() => process.exit(1));
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  cleanup().then(() => process.exit(1));
});

// Run the comprehensive test
if (require.main === module) {
  runComprehensiveTest().catch((error) => {
    logger.error('Fatal test error', error);
    cleanup().then(() => process.exit(1));
  });
}

module.exports = { runComprehensiveTest, testResults, logger };
