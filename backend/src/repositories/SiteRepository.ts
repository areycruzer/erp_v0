import { query, run, queryOne } from '../config/database';
import {
  Site,
  CreateSiteInput,
  UpdateSiteInput,
  InterpretationMode
} from '../types/database';

export class SiteRepository {
  // Create a new site
  static async create(siteData: CreateSiteInput): Promise<Site> {
    // Generate a UUID-like ID using SQLite's randomblob
    const siteIdResult = await query('SELECT lower(hex(randomblob(16))) as id', []);
    const id = siteIdResult[0].id;
    
    const sql = `
      INSERT INTO sites (id, name, location, notes, full_day_hours, interpretation_mode, checkpoint_time, timezone)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const values = [
      id,
      siteData.name,
      siteData.location || null,
      siteData.notes || null,
      siteData.full_day_hours || 8,
      siteData.interpretation_mode || 'HOURS',
      siteData.checkpoint_time || '08:00:00',
      siteData.timezone || 'UTC'
    ];
    
    await run(sql, values);
    
    // Use queryOne for single record retrieval
    const createdSite = await queryOne('SELECT * FROM sites WHERE id = ?', [id]);
    
    if (!createdSite) {
      throw new Error('Failed to create site');
    }
    
    return createdSite;
  }

  // Find site by ID
  static async findById(id: string): Promise<Site | null> {
    const sql = 'SELECT * FROM sites WHERE id = ?';
    const result = await query(sql, [id]);
    return result[0] || null;
  }

  // Get all sites
  static async findAll(): Promise<Site[]> {
    const sql = 'SELECT * FROM sites ORDER BY name';
    const result = await query(sql);
    return result;
  }

  // Find sites by name (partial match)
  static async findByName(name: string): Promise<Site[]> {
    const sql = 'SELECT * FROM sites WHERE name LIKE ? ORDER BY name';
    const result = await query(sql, [`%${name}%`]);
    return result;
  }

  // Get sites assigned to a specific user
  static async findByUserId(userId: string): Promise<Site[]> {
    const sql = `
      SELECT s.* FROM sites s
      JOIN user_site_assignments usa ON s.id = usa.site_id
      WHERE usa.user_id = ?
      ORDER BY s.name
    `;
    
    const result = await query(sql, [userId]);
    return result;
  }

  // Get workers assigned to a site
  static async getWorkers(
    siteId: string, 
    isActive?: boolean, 
    search?: string
  ): Promise<any[]> {
    let sql = `
      SELECT 
        id,
        name,
        father_name,
        phone_number,
        is_active,
        created_at,
        updated_at
      FROM workers 
      WHERE site_id = ?
    `;
    
    const params: any[] = [siteId];
    
    // Add filtering conditions
    if (isActive !== undefined) {
      sql += ' AND is_active = ?';
      params.push(isActive ? 1 : 0);
    }
    
    if (search && search.trim()) {
      sql += ' AND (name LIKE ? OR father_name LIKE ? OR phone_number LIKE ?)';
      const searchPattern = `%${search.trim()}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }
    
    sql += ' ORDER BY name';
    
    const result = await query(sql, params);
    return result;
  }

  // Update site
  static async update(id: string, siteData: UpdateSiteInput): Promise<Site | null> {
    const fields: string[] = [];
    const values: any[] = [];

    // Build dynamic update query
    Object.entries(siteData).forEach(([key, value]) => {
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
      UPDATE sites 
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    await run(sql, values);
    return await this.findById(id);
  }

  // Delete site (this will cascade to workers and attendance records)
  static async delete(id: string): Promise<boolean> {
    const sql = 'DELETE FROM sites WHERE id = ?';
    const result = await run(sql, [id]);
    return (result.changes || 0) > 0;
  }

  // Get site statistics
  static async getStatistics(id: string): Promise<{
    total_workers: number;
    active_workers: number;
    total_attendance_records: number;
    pending_approvals: number;
  } | null> {
    const sql = `
      SELECT 
        COUNT(DISTINCT w.id) as total_workers,
        COUNT(DISTINCT CASE WHEN w.is_active = 1 THEN w.id END) as active_workers,
        COUNT(DISTINCT ar.id) as total_attendance_records,
        COUNT(DISTINCT CASE WHEN ar.verified = 0 THEN ar.id END) as pending_approvals
      FROM sites s
      LEFT JOIN workers w ON s.id = w.site_id
      LEFT JOIN attendance_records ar ON s.id = ar.site_id
      WHERE s.id = ?
      GROUP BY s.id
    `;
    
    const result = await query(sql, [id]);
    
    if (result.length === 0) {
      return null;
    }
    
    return {
      total_workers: parseInt(result[0].total_workers) || 0,
      active_workers: parseInt(result[0].active_workers) || 0,
      total_attendance_records: parseInt(result[0].total_attendance_records) || 0,
      pending_approvals: parseInt(result[0].pending_approvals) || 0
    };
  }

  // Calculate hours based on site configuration
  static calculateHours(site: Site, xValue: number, yValue: number): number {
    const { full_day_hours, interpretation_mode } = site;
    
    if (interpretation_mode === 'HALF_DAYS') {
      // X * P + Y * (P/2)
      return xValue * full_day_hours + yValue * (full_day_hours / 2);
    } else {
      // Default HOURS mode: X * P + Y
      return xValue * full_day_hours + yValue;
    }
  }

  // Validate site configuration
  static validateConfiguration(siteData: CreateSiteInput | UpdateSiteInput): string[] {
    const errors: string[] = [];
    
    if (siteData.full_day_hours !== undefined) {
      if (siteData.full_day_hours <= 0 || siteData.full_day_hours > 24) {
        errors.push('Full day hours must be between 1 and 24');
      }
    }
    
    if (siteData.checkpoint_time !== undefined) {
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/;
      if (!timeRegex.test(siteData.checkpoint_time)) {
        errors.push('Checkpoint time must be in HH:MM:SS format');
      }
    }
    
    if (siteData.interpretation_mode !== undefined) {
      const validModes: InterpretationMode[] = ['HOURS', 'HALF_DAYS'];
      if (!validModes.includes(siteData.interpretation_mode)) {
        errors.push('Interpretation mode must be either HOURS or HALF_DAYS');
      }
    }
    
    return errors;
  }
}