import { query } from '../config/database';
import { AuthService } from '../services/AuthService';

async function updateAdminPassword() {
  try {
    console.log('🔧 Updating admin password...');
    
    // Generate new hash for admin123
    const newPasswordHash = await AuthService.hashPassword('admin123');
    console.log('Generated new hash:', newPasswordHash);
    
    // Update the admin user
    const result = await query(
      'UPDATE users SET password_hash = ? WHERE email = ?',
      [newPasswordHash, 'admin@hajiri.local']
    );
    
    console.log('Update result:', result);
    
    // Verify the update
    const user = await query(
      'SELECT id, name, email, role, password_hash FROM users WHERE email = ?',
      ['admin@hajiri.local']
    );
    
    console.log('Updated user:', user[0]);
    console.log('✅ Admin password updated successfully');
    
  } catch (error) {
    console.error('❌ Failed to update admin password:', error);
  }
  
  process.exit(0);
}

updateAdminPassword();
