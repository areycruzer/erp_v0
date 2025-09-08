// Test script for user management endpoints
const testUserManagement = async () => {
  const baseUrl = 'http://localhost:3001';
  let adminToken = '';
  let foremanToken = '';
  
  try {
    console.log('=== Testing User Management API ===\n');

    // First, login as admin to get admin token
    console.log('1. Logging in as admin...');
    const adminLoginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@hajiri.com',
        password: 'password123'
      })
    });
    
    if (adminLoginResponse.ok) {
      const adminData = await adminLoginResponse.json();
      adminToken = adminData.data.token;
      console.log('✅ Admin login successful');
    } else {
      console.log('❌ Admin login failed');
      return;
    }

    // Login as foreman to get foreman token
    console.log('\n2. Logging in as foreman...');
    const foremanLoginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'user2@hajiri.com',
        password: 'password123'
      })
    });
    
    if (foremanLoginResponse.ok) {
      const foremanData = await foremanLoginResponse.json();
      foremanToken = foremanData.data.token;
      console.log('✅ Foreman login successful');
    } else {
      console.log('❌ Foreman login failed');
    }

    // Test 1: Get all users (Admin only)
    console.log('\n3. Testing GET /api/users (Admin access)...');
    const getUsersResponse = await fetch(`${baseUrl}/api/users`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    
    if (getUsersResponse.ok) {
      const usersData = await getUsersResponse.json();
      console.log('✅ Get users successful');
      console.log(`   Found ${usersData.data.users.length} users`);
    } else {
      console.log('❌ Get users failed');
    }

    // Test 2: Try to get users as foreman (should fail)
    console.log('\n4. Testing GET /api/users (Foreman access - should fail)...');
    const foremanGetUsersResponse = await fetch(`${baseUrl}/api/users`, {
      headers: { 'Authorization': `Bearer ${foremanToken}` }
    });
    
    if (foremanGetUsersResponse.status === 403) {
      console.log('✅ Foreman correctly denied access to get all users');
    } else {
      console.log('❌ Security issue: Foreman should not access all users');
    }

    // Test 3: Create a new user (Admin only)
    console.log('\n5. Testing POST /api/users (Create user)...');
    const timestamp = Date.now();
    const createUserResponse = await fetch(`${baseUrl}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: 'Test Site Manager',
        email: `sitemanager${timestamp}@hajiri.com`,
        password: 'password123',
        phone: '1234567890',
        role: 'SITE_INCHARGE'
      })
    });
    
    let newUserId = '';
    if (createUserResponse.ok) {
      const newUserData = await createUserResponse.json();
      newUserId = newUserData.data.user.id;
      console.log('✅ User created successfully');
      console.log(`   New user ID: ${newUserId}`);
    } else {
      const errorData = await createUserResponse.json();
      console.log('❌ User creation failed:', errorData.message);
      if (errorData.errors) {
        console.log('   Validation errors:', errorData.errors);
      }
    }

    // Test 4: Get specific user by ID
    if (newUserId) {
      console.log('\n6. Testing GET /api/users/:id...');
      const getUserResponse = await fetch(`${baseUrl}/api/users/${newUserId}`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      
      if (getUserResponse.ok) {
        const userData = await getUserResponse.json();
        console.log('✅ Get user by ID successful');
        console.log(`   User: ${userData.data.user.name} (${userData.data.user.email})`);
      } else {
        console.log('❌ Get user by ID failed');
      }
    }

    // Test 5: Update user
    if (newUserId) {
      console.log('\n7. Testing PUT /api/users/:id (Update user)...');
      const updateUserResponse = await fetch(`${baseUrl}/api/users/${newUserId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          name: 'Updated Site Manager',
          phone: '0987654321'
        })
      });
      
      if (updateUserResponse.ok) {
        const updatedUserData = await updateUserResponse.json();
        console.log('✅ User updated successfully');
        console.log(`   Updated name: ${updatedUserData.data.user.name}`);
      } else {
        const errorData = await updateUserResponse.json();
        console.log('❌ User update failed:', errorData.message);
        if (errorData.errors) {
          console.log('   Validation errors:', errorData.errors);
        }
      }
    }

    // Test 6: Test user accessing their own data
    if (foremanToken) {
      console.log('\n8. Testing user accessing own data...');
      // First get the foreman's user ID
      const meResponse = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${foremanToken}` }
      });
      
      if (meResponse.ok) {
        const meData = await meResponse.json();
        const foremanId = meData.data.user.id;
        
        const ownDataResponse = await fetch(`${baseUrl}/api/users/${foremanId}`, {
          headers: { 'Authorization': `Bearer ${foremanToken}` }
        });
        
        if (ownDataResponse.ok) {
          console.log('✅ User can access their own data');
        } else {
          console.log('❌ User cannot access their own data');
        }
      }
    }

    // Test 7: Deactivate user
    if (newUserId) {
      console.log('\n9. Testing PUT /api/users/:id/deactivate...');
      const deactivateResponse = await fetch(`${baseUrl}/api/users/${newUserId}/deactivate`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      
      if (deactivateResponse.ok) {
        console.log('✅ User deactivated successfully');
      } else {
        console.log('❌ User deactivation failed');
      }
    }

    // Test 8: Try to create duplicate user
    console.log('\n10. Testing duplicate email validation...');
    const duplicateUserResponse = await fetch(`${baseUrl}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: 'Duplicate User',
        email: 'admin@hajiri.com', // This email already exists
        password: 'password123',
        role: 'FOREMAN'
      })
    });
    
    if (duplicateUserResponse.status === 409) {
      console.log('✅ Duplicate email correctly rejected');
    } else {
      console.log('❌ Duplicate email validation failed');
    }

    console.log('\n=== User Management API Tests Complete ===');
    
  } catch (error) {
    console.error('Test error:', error.message);
  }
};

testUserManagement();
