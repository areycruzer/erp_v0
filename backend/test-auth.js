// Test script for authentication endpoints
const testAuth = async () => {
  const baseUrl = 'http://localhost:3001';
  
  try {
    // Test health check
    console.log('Testing health check...');
    const healthResponse = await fetch(`${baseUrl}/health`);
    const healthData = await healthResponse.json();
    console.log('Health check:', healthData);

    // Test user registration
    console.log('\nTesting user registration...');
    const registerResponse = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Test User 2',
        email: 'user2@hajiri.com',
        password: 'password123',
        role: 'FOREMAN'
      })
    });
    
    const registerData = await registerResponse.json();
    console.log('Registration response:', registerData);
    
    if (registerResponse.ok) {
      const { token } = registerData.data;
      
      // Test login
      console.log('\nTesting login...');
      const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: 'user2@hajiri.com',
          password: 'password123'
        })
      });
      
      const loginData = await loginResponse.json();
      console.log('Login response:', loginData);
      
      // Test authenticated endpoint
      if (loginResponse.ok) {
        console.log('\nTesting authenticated endpoint...');
        const meResponse = await fetch(`${baseUrl}/api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${loginData.data.token}`
          }
        });
        
        const meData = await meResponse.json();
        console.log('Me endpoint response:', meData);
      }
    }
    
  } catch (error) {
    console.error('Test error:', error.message);
  }
};

testAuth();
