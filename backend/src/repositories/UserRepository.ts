import { query, withTransaction, run } from '../config/database';
import {
  User,
  CreateUserInput,
  UpdateUserInput,
  UserWithSites,
  UserRole
} from '../types/database';

export class UserRepository {
  // Create a new user
  static async create(userData: CreateUserInput): Promise<User> {
    // Generate a UUID-like ID
    const userId = await query('SELECT lower(hex(randomblob(16))) as id', []);
    const newUserId = userId[0].id;
    
    const sql = `
      INSERT INTO users (id, name, email, phone, password_hash, role, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    const values = [
      newUserId,
      userData.name,
      userData.email,
      userData.phone || null,
      userData.password_hash,
      userData.role || 'FOREMAN',
      userData.is_active !== undefined ? userData.is_active : 1
    ];
    
    await run(sql, values);
    
    // Get the created user
    const createdUser = await this.findById(newUserId);
    if (!createdUser) {
      throw new Error('Failed to create user');
    }
    return createdUser;
  }

  // Find user by ID
  static async findById(id: string): Promise<User | null> {
    const sql = 'SELECT * FROM users WHERE id = ?';
    const result = await query(sql, [id]);
    return result[0] || null;
  }

  // Find user by email
  static async findByEmail(email: string): Promise<User | null> {
    const sql = 'SELECT * FROM users WHERE email = ?';
    const result = await query(sql, [email]);
    return result[0] || null;
  }

  // Find user with assigned sites (simplified for SQLite)
  static async findByIdWithSites(id: string): Promise<UserWithSites | null> {
    const userSql = 'SELECT * FROM users WHERE id = ?';
    const user = await query(userSql, [id]);
    
    if (!user[0]) return null;
    
    const sitesSql = `
      SELECT s.* FROM sites s
      JOIN user_site_assignments usa ON s.id = usa.site_id
      WHERE usa.user_id = ?
    `;
    const sites = await query(sitesSql, [id]);
    
    return {
      ...user[0],
      assigned_sites: sites
    };
  }

  // Get all users with optional role filter
  static async findAll(role?: UserRole, isActive?: boolean): Promise<User[]> {
    let sql = 'SELECT * FROM users WHERE 1=1';
    const values: any[] = [];

    if (role) {
      sql += ' AND role = ?';
      values.push(role);
    }

    if (isActive !== undefined) {
      sql += ' AND is_active = ?';
      values.push(isActive ? 1 : 0);
    }

    sql += ' ORDER BY created_at DESC';
    
    const result = await query(sql, values);
    return result;
  }

  // Update user
  static async update(id: string, userData: UpdateUserInput): Promise<User | null> {
    const fields: string[] = [];
    const values: any[] = [];

    // Build dynamic update query
    Object.entries(userData).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    });

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(id);

    const sql = `
      UPDATE users 
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    await run(sql, values);
    return await this.findById(id);
  }

  // Assign user to site
  static async assignToSite(userId: string, siteId: string): Promise<void> {
    const sql = `
      INSERT OR IGNORE INTO user_site_assignments (user_id, site_id)
      VALUES (?, ?)
    `;
    
    await run(sql, [userId, siteId]);
  }

  // Remove user from site
  static async removeFromSite(userId: string, siteId: string): Promise<void> {
    const sql = 'DELETE FROM user_site_assignments WHERE user_id = ? AND site_id = ?';
    await run(sql, [userId, siteId]);
  }

  // Get users assigned to a specific site
  static async findBySiteId(siteId: string, role?: UserRole): Promise<User[]> {
    let sql = `
      SELECT u.* FROM users u
      JOIN user_site_assignments usa ON u.id = usa.user_id
      WHERE usa.site_id = ? AND u.is_active = 1
    `;
    
    const values: any[] = [siteId];
    
    if (role) {
      sql += ' AND u.role = ?';
      values.push(role);
    }
    
    sql += ' ORDER BY u.name';
    
    const result = await query(sql, values);
    return result;
  }

  // Soft delete user (deactivate)
  static async deactivate(id: string): Promise<User | null> {
    const sql = `
      UPDATE users 
      SET is_active = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    await run(sql, [id]);
    return await this.findById(id);
  }

  // Hard delete user (use with caution)
  static async delete(id: string): Promise<boolean> {
    return withTransaction(async (db) => {
      // First delete user site assignments
      await db.run('DELETE FROM user_site_assignments WHERE user_id = ?', [id]);
      
      // Then delete the user
      const result = await db.run('DELETE FROM users WHERE id = ?', [id]);
      
      return (result.changes || 0) > 0;
    });
  }
}