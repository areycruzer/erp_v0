/**
 * Hajiri System Health Check Script
 * Simple test to verify all core functionality
 * Run in browser console or with basic node setup
 */

// Test configuration
const TEST_CONFIG = {
  BACKEND_URL: 'http://localhost:3004/api',
  FRONTEND_URL: 'http://localhost:3001',
  TIMEOUT: 10000
};

// Test results
let testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: []
};

// Simple HTTP client
async function makeRequest(url, options = {}) {
  const defaultOptions = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    },
    timeout: TEST_CONFIG.TIMEOUT
  };
  
  const finalOptions = { ...defaultOptions, ...options };
  
  if (finalOptions.body && typeof finalOptions.body === 'object') {
    finalOptions.body = JSON.stringify(finalOptions.body);
  }
  
  try {
    const response = await fetch(url, finalOptions);
    const data = await response.json().catch(() => ({}));
    return { status: response.status, data, ok: response.ok };
  } catch (error) {
    throw new Error(`Request failed: ${error.message}`);
  }
}

// Test execution wrapper
async function runTest(testName, testFunction) {
  testResults.total++;
  console.log(`🧪 Running: ${testName}`);
  
  try {
    await testFunction();
    testResults.passed++;
    console.log(`✅ Passed: ${testName}`);
  } catch (error) {
    testResults.failed++;
    testResults.errors.push({ test: testName, error: error.message });
    console.error(`❌ Failed: ${testName} - ${error.message}`);
  }
}

// Test functions
async function testBackendHealth() {
  const response = await makeRequest(`${TEST_CONFIG.BACKEND_URL}/health`);
  if (response.status !== 200) {
    throw new Error(`Backend health check failed. Status: ${response.status}`);
  }
  if (!response.data.database || response.data.database !== 'connected') {
    throw new Error('Database not connected');
  }
}

async function testAuthentication() {
  // Test admin login
  const loginResponse = await makeRequest(`${TEST_CONFIG.BACKEND_URL}/auth/login`, {
    method: 'POST',
    body: {
      email: 'admin@hajiri.com',
      password: 'admin123'
    }
  });
  
  if (loginResponse.status !== 200) {
    throw new Error(`Login failed. Status: ${loginResponse.status}`);
  }
  
  if (!loginResponse.data.token) {
    throw new Error('No token returned from login');
  }
  
  // Store token for other tests
  window.authToken = loginResponse.data.token;
  
  // Test token validation
  const meResponse = await makeRequest(`${TEST_CONFIG.BACKEND_URL}/auth/me`, {
    headers: {
      'Authorization': `Bearer ${window.authToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (meResponse.status !== 200) {
    throw new Error(`Token validation failed. Status: ${meResponse.status}`);
  }
}

async function testUserManagement() {
  const headers = {
    'Authorization': `Bearer ${window.authToken}`,
    'Content-Type': 'application/json'
  };
  
  // List users
  const usersResponse = await makeRequest(`${TEST_CONFIG.BACKEND_URL}/users`, { headers });
  
  if (usersResponse.status !== 200) {
    throw new Error(`Users list failed. Status: ${usersResponse.status}`);
  }
  
  if (!Array.isArray(usersResponse.data)) {
    throw new Error('Users response is not an array');
  }
}

async function testSiteManagement() {
  const headers = {
    'Authorization': `Bearer ${window.authToken}`,
    'Content-Type': 'application/json'
  };
  
  // List sites
  const sitesResponse = await makeRequest(`${TEST_CONFIG.BACKEND_URL}/sites`, { headers });
  
  if (sitesResponse.status !== 200) {
    throw new Error(`Sites list failed. Status: ${sitesResponse.status}`);
  }
}

async function testWorkerManagement() {
  const headers = {
    'Authorization': `Bearer ${window.authToken}`,
    'Content-Type': 'application/json'
  };
  
  // List workers
  const workersResponse = await makeRequest(`${TEST_CONFIG.BACKEND_URL}/workers`, { headers });
  
  if (workersResponse.status !== 200) {
    throw new Error(`Workers list failed. Status: ${workersResponse.status}`);
  }
}

async function testAttendanceSystem() {
  const headers = {
    'Authorization': `Bearer ${window.authToken}`,
    'Content-Type': 'application/json'
  };
  
  // List attendance
  const attendanceResponse = await makeRequest(`${TEST_CONFIG.BACKEND_URL}/attendance`, { headers });
  
  if (attendanceResponse.status !== 200) {
    throw new Error(`Attendance list failed. Status: ${attendanceResponse.status}`);
  }
}

async function testAuditSystem() {
  const headers = {
    'Authorization': `Bearer ${window.authToken}`,
    'Content-Type': 'application/json'
  };
  
  // Test audit logs
  const auditResponse = await makeRequest(`${TEST_CONFIG.BACKEND_URL}/audit/logs`, { headers });
  
  if (auditResponse.status !== 200) {
    throw new Error(`Audit logs failed. Status: ${auditResponse.status}`);
  }
  
  // Test audit analytics
  const analyticsResponse = await makeRequest(`${TEST_CONFIG.BACKEND_URL}/audit/analytics`, { headers });
  
  if (analyticsResponse.status !== 200) {
    throw new Error(`Audit analytics failed. Status: ${analyticsResponse.status}`);
  }
}

async function testNotificationSystem() {
  const headers = {
    'Authorization': `Bearer ${window.authToken}`,
    'Content-Type': 'application/json'
  };
  
  // Test notifications
  const notificationsResponse = await makeRequest(`${TEST_CONFIG.BACKEND_URL}/notifications`, { headers });
  
  if (notificationsResponse.status !== 200) {
    throw new Error(`Notifications failed. Status: ${notificationsResponse.status}`);
  }
}

async function testFrontendAccess() {
  try {
    const frontendResponse = await makeRequest(TEST_CONFIG.FRONTEND_URL);
    
    if (frontendResponse.status !== 200) {
      throw new Error(`Frontend not accessible. Status: ${frontendResponse.status}`);
    }
  } catch (error) {
    throw new Error(`Frontend access failed: ${error.message}`);
  }
}

async function testPWAComponents() {
  try {
    // Test manifest
    const manifestResponse = await makeRequest(`${TEST_CONFIG.FRONTEND_URL}/manifest.json`);
    if (manifestResponse.status !== 200) {
      throw new Error('PWA manifest not accessible');
    }
    
    // Test service worker
    const swResponse = await makeRequest(`${TEST_CONFIG.FRONTEND_URL}/sw.js`);
    if (swResponse.status !== 200) {
      throw new Error('Service worker not accessible');
    }
    
    // Check if service worker is registered in browser
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        console.warn('Service worker not registered in browser');
      }
    }
  } catch (error) {
    throw new Error(`PWA components test failed: ${error.message}`);
  }
}

async function testSecurity() {
  // Test unauthorized access
  const unauthorizedResponse = await makeRequest(`${TEST_CONFIG.BACKEND_URL}/users`);
  
  if (unauthorizedResponse.status !== 401) {
    throw new Error('Unauthorized access not properly blocked');
  }
  
  // Test invalid token
  const invalidTokenResponse = await makeRequest(`${TEST_CONFIG.BACKEND_URL}/users`, {
    headers: {
      'Authorization': 'Bearer invalid-token',
      'Content-Type': 'application/json'
    }
  });
  
  if (invalidTokenResponse.status !== 401) {
    throw new Error('Invalid token not properly rejected');
  }
}

// Main test execution
async function runComprehensiveHealthCheck() {
  console.log('🚀 Starting Hajiri System Health Check');
  console.log('=' .repeat(50));
  
  testResults = { total: 0, passed: 0, failed: 0, errors: [] };
  
  try {
    await runTest('Backend Health Check', testBackendHealth);
    await runTest('Authentication System', testAuthentication);
    await runTest('User Management', testUserManagement);
    await runTest('Site Management', testSiteManagement);
    await runTest('Worker Management', testWorkerManagement);
    await runTest('Attendance System', testAttendanceSystem);
    await runTest('Audit System', testAuditSystem);
    await runTest('Notification System', testNotificationSystem);
    await runTest('Frontend Access', testFrontendAccess);
    await runTest('PWA Components', testPWAComponents);
    await runTest('Security Measures', testSecurity);
  } catch (error) {
    console.error('❌ Critical test failure:', error.message);
  }
  
  // Generate report
  console.log('\n' + '='.repeat(50));
  console.log('📊 HEALTH CHECK RESULTS');
  console.log('='.repeat(50));
  console.log(`Total Tests: ${testResults.total}`);
  console.log(`Passed: ${testResults.passed} ✅`);
  console.log(`Failed: ${testResults.failed} ❌`);
  console.log(`Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);
  
  if (testResults.failed === 0) {
    console.log('\n🎉 ALL SYSTEMS OPERATIONAL!');
    console.log('✅ Hajiri Attendance System is fully functional');
  } else {
    console.log('\n⚠️ Issues Detected:');
    testResults.errors.forEach((error, index) => {
      console.log(`${index + 1}. ${error.test}: ${error.error}`);
    });
  }
  
  console.log('\n🔗 System URLs:');
  console.log(`Frontend: ${TEST_CONFIG.FRONTEND_URL}`);
  console.log(`Backend: ${TEST_CONFIG.BACKEND_URL}`);
  console.log('=' .repeat(50));
  
  return testResults;
}

// Export for use in different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runComprehensiveHealthCheck, testResults };
} else if (typeof window !== 'undefined') {
  window.hajiriHealthCheck = runComprehensiveHealthCheck;
}

// Auto-run if loaded directly
if (typeof window !== 'undefined' && window.location) {
  console.log('🧪 Hajiri Health Check script loaded. Run hajiriHealthCheck() to start tests.');
}
