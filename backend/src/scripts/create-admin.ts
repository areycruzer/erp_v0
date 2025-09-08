import { AuthService } from '../services/AuthService';

async function createAdminPassword() {
  try {
    // Hash the password 'admin123'
    const hashedPassword = await AuthService.hashPassword('admin123');
    console.log('Hashed password for admin123:', hashedPassword);
    
    // Also create some test user passwords
    const testPassword = await AuthService.hashPassword('hajiri123');
    console.log('Hashed password for hajiri123:', testPassword);
    
  } catch (error) {
    console.error('Error hashing passwords:', error);
  }
}

createAdminPassword();
