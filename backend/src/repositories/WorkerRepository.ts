import { query, run } from '../config/database';
import {
  Worker,
  CreateWorkerInput,
  UpdateWorkerInput,
  WorkerWithSite,
  WorkerFilters
} from '../types/database';

export class WorkerRepository {
  // Create a new worker with auto-generated ID
  static async create(workerData: CreateWorkerInput): Promise<Worker> {
    const workerId = `worker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const sql = `
      INSERT INTO workers (id, name, father_name, adhar_number_encrypted, phone_number, site_id, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    const values = [
      workerId,
      workerData.name,
      workerData.father_name,
      workerData.adhar_number_encrypted || null,
      workerData.phone_number || null,
      workerData.site_id,
      workerData.is_active !== undefined ? workerData.is_active : 1
    ];
    
    await run(sql, values);
    const createdWorker = await this.findById(workerId);
    if (!createdWorker) {
      throw new Error('Failed to create worker');
    }
    return createdWorker;
  }

  // Find worker by ID
  static async findById(id: string): Promise<Worker | null> {
    const sql = 'SELECT * FROM workers WHERE id = ?';
    const result = await query(sql, [id]);
    return result[0] || null;
  }

  // Find worker by ID with site information (SQLite compatible)
  static async findByIdWithSite(id: string): Promise<WorkerWithSite | null> {
    const sql = `
      SELECT 
        w.*,
        s.id as site_id,
        s.name as site_name,
        s.location as site_location,
        s.notes as site_notes,
        s.full_day_hours as site_full_day_hours,
        s.interpretation_mode as site_interpretation_mode,
        s.checkpoint_time as site_checkpoint_time,
        s.timezone as site_timezone,
        s.created_at as site_created_at,
        s.updated_at as site_updated_at
      FROM workers w
      JOIN sites s ON w.site_id = s.id
      WHERE w.id = ?
    `;
    
    const result = await query(sql, [id]);
    if (result.length === 0) return null;
    
    const row = result[0];
    return {
      ...row,
      site: {
        id: row.site_id,
        name: row.site_name,
        location: row.site_location,
        notes: row.site_notes,
        full_day_hours: row.site_full_day_hours,
        interpretation_mode: row.site_interpretation_mode,
        checkpoint_time: row.site_checkpoint_time,
        timezone: row.site_timezone,
        created_at: row.site_created_at,
        updated_at: row.site_updated_at
      }
    };
  }

  // Get workers with filters (SQLite compatible with pagination)
  static async findAll(filters: WorkerFilters & { offset?: number; limit?: number; status?: string } = {}): Promise<Worker[]> {
    let sql = 'SELECT * FROM workers WHERE 1=1';
    const values: any[] = [];

    if (filters.site_id) {
      sql += ` AND site_id = ?`;
      values.push(filters.site_id);
    }

    if (filters.is_active !== undefined) {
      sql += ` AND is_active = ?`;
      values.push(filters.is_active);
    }

    // Handle status filter (convert to is_active boolean)
    if (filters.status) {
      const isActive = filters.status === 'active' ? 1 : 0;
      sql += ` AND is_active = ?`;
      values.push(isActive);
    }

    if (filters.search) {
      sql += ` AND (name LIKE ? OR father_name LIKE ?)`;
      values.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    sql += ' ORDER BY name, father_name';

    // Add pagination if provided
    if (filters.limit) {
      sql += ` LIMIT ?`;
      values.push(filters.limit);
      
      if (filters.offset) {
        sql += ` OFFSET ?`;
        values.push(filters.offset);
      }
    }
    
    const result = await query(sql, values);
    return result;
  }

  // Get workers with site information (SQLite compatible)
  static async findAllWithSites(filters: WorkerFilters = {}): Promise<WorkerWithSite[]> {
    let sql = `
      SELECT 
        w.*,
        s.id as site_id,
        s.name as site_name,
        s.location as site_location,
        s.notes as site_notes,
        s.full_day_hours as site_full_day_hours,
        s.interpretation_mode as site_interpretation_mode,
        s.checkpoint_time as site_checkpoint_time,
        s.timezone as site_timezone,
        s.created_at as site_created_at,
        s.updated_at as site_updated_at
      FROM workers w
      JOIN sites s ON w.site_id = s.id
      WHERE 1=1
    `;
    
    const values: any[] = [];

    if (filters.site_id) {
      sql += ` AND w.site_id = ?`;
      values.push(filters.site_id);
    }

    if (filters.is_active !== undefined) {
      sql += ` AND w.is_active = ?`;
      values.push(filters.is_active);
    }

    if (filters.search) {
      sql += ` AND (w.name LIKE ? OR w.father_name LIKE ?)`;
      values.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    sql += ' ORDER BY w.name, w.father_name';
    
    const result = await query(sql, values);
    
    // Transform the result to match the expected structure
    return result.map((row: any) => ({
      ...row,
      site: {
        id: row.site_id,
        name: row.site_name,
        location: row.site_location,
        notes: row.site_notes,
        full_day_hours: row.site_full_day_hours,
        interpretation_mode: row.site_interpretation_mode,
        checkpoint_time: row.site_checkpoint_time,
        timezone: row.site_timezone,
        created_at: row.site_created_at,
        updated_at: row.site_updated_at
      }
    }));
  }

  // Find workers by site ID
  static async findBySiteId(siteId: string, isActive?: boolean): Promise<Worker[]> {
    let sql = 'SELECT * FROM workers WHERE site_id = ?';
    const values: any[] = [siteId];

    if (isActive !== undefined) {
      sql += ' AND is_active = ?';
      values.push(isActive);
    }

    sql += ' ORDER BY name, father_name';
    
    const result = await query(sql, values);
    return result;
  }

  // Update worker
  static async update(id: string, workerData: UpdateWorkerInput): Promise<Worker | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    // Build dynamic update query (SQLite compatible)
    Object.entries(workerData).forEach(([key, value]) => {
      if (value !== undefined) {
        paramCount++;
        fields.push(`${key} = ?`);
        values.push(value);
      }
    });

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(id);

    const sql = `
      UPDATE workers 
      SET ${fields.join(', ')}, updated_at = datetime('now')
      WHERE id = ?
    `;

    await query(sql, values);
    return this.findById(id);
  }

  // Transfer worker to different site (SQLite compatible)
  static async transferToSite(workerId: string, newSiteId: string): Promise<Worker | null> {
    // Update worker's site
    const sql = 'UPDATE workers SET site_id = ?, updated_at = datetime(\'now\') WHERE id = ?';
    const result = await query(sql, [newSiteId, workerId]);

    if (result.length === 0) {
      throw new Error('Worker not found');
    }

    // Get updated worker
    return this.findById(workerId);
  }

  // Soft delete worker (deactivate) - SQLite compatible
  static async deactivate(id: string): Promise<Worker | null> {
    const sql = `
      UPDATE workers 
      SET is_active = 0, updated_at = datetime('now')
      WHERE id = ?
    `;
    
    await query(sql, [id]);
    return this.findById(id);
  }

  // Hard delete worker (use with caution - will affect attendance records)
  static async delete(id: string): Promise<boolean> {
    const sql = 'DELETE FROM workers WHERE id = ?';
    const result = await query(sql, [id]);
    return result.changes > 0;
  }

  // Get worker attendance statistics
  static async getAttendanceStatistics(workerId: string, dateFrom?: string, dateTo?: string): Promise<{
    total_days: number;
    present_days: number;
    absent_days: number;
    total_hours: number;
    average_hours_per_day: number;
  } | null> {
    let sql = `
      SELECT 
        COUNT(*) as total_days,
        COUNT(CASE WHEN status = 'PRESENT' THEN 1 END) as present_days,
        COUNT(CASE WHEN status = 'ABSENT' THEN 1 END) as absent_days,
        COALESCE(SUM(calculated_hours), 0) as total_hours,
        COALESCE(AVG(CASE WHEN status = 'PRESENT' THEN calculated_hours END), 0) as average_hours_per_day
      FROM attendance_records
      WHERE worker_id = ?
    `;
    
    const values: any[] = [workerId];
    let paramCount = 1;

    if (dateFrom) {
      paramCount++;
      sql += ` AND date >= $${paramCount}`;
      values.push(dateFrom);
    }

    if (dateTo) {
      paramCount++;
      sql += ` AND date <= $${paramCount}`;
      values.push(dateTo);
    }
    
    const result = await query(sql, values);
    
    if (result.length === 0) {
      return null;
    }
    
    const row = result[0];
    return {
      total_days: parseInt(row.total_days) || 0,
      present_days: parseInt(row.present_days) || 0,
      absent_days: parseInt(row.absent_days) || 0,
      total_hours: parseFloat(row.total_hours) || 0,
      average_hours_per_day: parseFloat(row.average_hours_per_day) || 0
    };
  }

  // Check if worker exists and is active
  static async isActiveWorker(id: string): Promise<boolean> {
    const sql = 'SELECT is_active FROM workers WHERE id = ?';
    const result = await query(sql, [id]);
    return result.length > 0 && result[0].is_active;
  }

  // Get total count with filters
  static async getTotalCount(filters: { site_id?: string; status?: string } = {}): Promise<number> {
    const conditions: string[] = [];
    const values: any[] = [];

    if (filters.site_id) {
      conditions.push('site_id = ?');
      values.push(filters.site_id);
    }

    if (filters.status) {
      const isActive = filters.status === 'active' ? 1 : 0;
      conditions.push('is_active = ?');
      values.push(isActive);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT COUNT(*) as count FROM workers ${whereClause}`;
    
    const result = await query(sql, values);
    return result[0].count;
  }

  // Validate worker data
  static validateWorkerData(workerData: CreateWorkerInput | UpdateWorkerInput): string[] {
    const errors: string[] = [];
    
    if ('name' in workerData && workerData.name !== undefined) {
      if (!workerData.name || workerData.name.trim().length === 0) {
        errors.push('Worker name is required');
      }
      if (workerData.name.length > 255) {
        errors.push('Worker name must be less than 255 characters');
      }
    }
    
    if ('father_name' in workerData && workerData.father_name !== undefined) {
      if (!workerData.father_name || workerData.father_name.trim().length === 0) {
        errors.push('Father name is required');
      }
      if (workerData.father_name.length > 255) {
        errors.push('Father name must be less than 255 characters');
      }
    }
    
    if ('phone_number' in workerData && workerData.phone_number !== undefined) {
      if (workerData.phone_number && workerData.phone_number.length > 20) {
        errors.push('Phone number must be less than 20 characters');
      }
    }
    
    return errors;
  }
}