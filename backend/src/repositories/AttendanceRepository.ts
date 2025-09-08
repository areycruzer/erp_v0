import { query, run } from '../config/database';
import {
  AttendanceRecord,
  CreateAttendanceRecordInput,
  UpdateAttendanceRecordInput,
  AttendanceRecordFilters,
  AttendanceRecordWithDetails
} from '../types/database';

export class AttendanceRepository {
  // Create a new attendance record (SQLite compatible)
  static async create(recordData: CreateAttendanceRecordInput): Promise<AttendanceRecord> {
    const sql = `
      INSERT INTO attendance_records (
        id, site_id, worker_id, date, status, x_value, y_value, 
        calculated_hours, submitted_by, submitted_at, submitted_to_incharge,
        verified, approved_by, approved_at, original_status, original_x_value, original_y_value
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, 0, NULL, NULL, NULL, NULL, NULL)
    `;
    
    const recordId = `attendance-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const values = [
      recordId,
      recordData.site_id,
      recordData.worker_id,
      recordData.date,
      recordData.status,
      recordData.x_value,
      recordData.y_value,
      recordData.calculated_hours || 0,
      recordData.submitted_by,
      recordData.submitted_to_incharge || false
    ];
    
    await run(sql, values);
    const createdRecord = await this.findById(recordId);
    if (!createdRecord) {
      throw new Error('Failed to create attendance record');
    }
    return createdRecord;
  }

  // Find attendance record by ID
  static async findById(id: string): Promise<AttendanceRecord | null> {
    const sql = 'SELECT * FROM attendance_records WHERE id = ?';
    const result = await query(sql, [id]);
    return result[0] || null;
  }

  // Get all attendance records with optional filters and pagination
  static async findAll(filters: AttendanceRecordFilters & { offset?: number; limit?: number } = {}): Promise<AttendanceRecord[]> {
    let sql = 'SELECT * FROM attendance_records WHERE 1=1';
    const values: any[] = [];
    
    if (filters.site_id) {
      sql += ' AND site_id = ?';
      values.push(filters.site_id);
    }
    
    if (filters.worker_id) {
      sql += ' AND worker_id = ?';
      values.push(filters.worker_id);
    }

    if (filters.date_from) {
      sql += ' AND date >= ?';
      values.push(filters.date_from);
    }

    if (filters.date_to) {
      sql += ' AND date <= ?';
      values.push(filters.date_to);
    }

    if (filters.status) {
      sql += ' AND status = ?';
      values.push(filters.status);
    }

    if (filters.verified !== undefined) {
      sql += ' AND verified = ?';
      values.push(filters.verified ? 1 : 0);
    }
    
    sql += ' ORDER BY date DESC, submitted_at DESC';

    if (filters.limit) {
      sql += ' LIMIT ?';
      values.push(filters.limit);
      
      if (filters.offset) {
        sql += ' OFFSET ?';
        values.push(filters.offset);
      }
    }
    
    const result = await query(sql, values);
    return result;
  }

  // Get attendance records with worker and site details
  static async findAllWithDetails(filters: AttendanceRecordFilters & { offset?: number; limit?: number } = {}): Promise<AttendanceRecordWithDetails[]> {
    let sql = `
      SELECT 
        ar.*,
        w.name as worker_name,
        w.father_name as worker_father_name,
        w.phone_number as worker_phone,
        s.name as site_name,
        s.location as site_location,
        u.name as submitted_by_name,
        approver.name as approved_by_name
      FROM attendance_records ar
      JOIN workers w ON ar.worker_id = w.id
      JOIN sites s ON ar.site_id = s.id
      LEFT JOIN users u ON ar.submitted_by = u.id
      LEFT JOIN users approver ON ar.approved_by = approver.id
      WHERE 1=1
    `;
    
    const values: any[] = [];
    
    if (filters.site_id) {
      sql += ' AND ar.site_id = ?';
      values.push(filters.site_id);
    }
    
    if (filters.worker_id) {
      sql += ' AND ar.worker_id = ?';
      values.push(filters.worker_id);
    }

    if (filters.date_from) {
      sql += ' AND ar.date >= ?';
      values.push(filters.date_from);
    }

    if (filters.date_to) {
      sql += ' AND ar.date <= ?';
      values.push(filters.date_to);
    }

    if (filters.status) {
      sql += ' AND ar.status = ?';
      values.push(filters.status);
    }

    if (filters.verified !== undefined) {
      sql += ' AND ar.verified = ?';
      values.push(filters.verified ? 1 : 0);
    }
    
    sql += ' ORDER BY ar.date DESC, ar.submitted_at DESC';

    if (filters.limit) {
      sql += ' LIMIT ?';
      values.push(filters.limit);
      
      if (filters.offset) {
        sql += ' OFFSET ?';
        values.push(filters.offset);
      }
    }
    
    const result = await query(sql, values);
    return result;
  }

  // Get attendance record for specific worker and date
  static async findByWorkerAndDate(workerId: string, date: string): Promise<AttendanceRecord | null> {
    const sql = 'SELECT * FROM attendance_records WHERE worker_id = ? AND date = ?';
    const result = await query(sql, [workerId, date]);
    return result[0] || null;
  }

  // Update attendance record
  static async update(id: string, recordData: UpdateAttendanceRecordInput): Promise<AttendanceRecord | null> {
    const fields: string[] = [];
    const values: any[] = [];

    // Build dynamic update query
    Object.entries(recordData).forEach(([key, value]) => {
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
      UPDATE attendance_records 
      SET ${fields.join(', ')}
      WHERE id = ?
    `;

    await run(sql, values);
    return await this.findById(id);
  }

  // Mark attendance as verified by supervisor
  static async verifyAttendance(id: string, approvedBy: string): Promise<AttendanceRecord | null> {
    const sql = `
      UPDATE attendance_records 
      SET verified = 1, approved_by = ?, approved_at = datetime('now')
      WHERE id = ?
    `;
    
    await run(sql, [approvedBy, id]);
    return await this.findById(id);
  }

  // Bulk verify attendance records
  static async bulkVerifyAttendance(recordIds: string[], approvedBy: string): Promise<number> {
    const placeholders = recordIds.map(() => '?').join(',');
    const sql = `
      UPDATE attendance_records 
      SET verified = 1, approved_by = ?, approved_at = datetime('now')
      WHERE id IN (${placeholders})
    `;
    
    const result = await run(sql, [approvedBy, ...recordIds]);
    return result.changes || 0;
  }

  // Get attendance statistics for a worker
  static async getWorkerAttendanceStats(workerId: string, dateFrom?: string, dateTo?: string): Promise<{
    totalDays: number;
    presentDays: number;
    absentDays: number;
    totalHours: number;
    averageHoursPerDay: number;
    attendancePercentage: number;
  }> {
    let sql = `
      SELECT 
        COUNT(*) as total_days,
        SUM(CASE WHEN status = 'PRESENT' THEN 1 ELSE 0 END) as present_days,
        SUM(CASE WHEN status = 'ABSENT' THEN 1 ELSE 0 END) as absent_days,
        SUM(calculated_hours) as total_hours,
        AVG(calculated_hours) as avg_hours
      FROM attendance_records 
      WHERE worker_id = ?
    `;
    
    const values = [workerId];
    
    if (dateFrom) {
      sql += ' AND date >= ?';
      values.push(dateFrom);
    }
    
    if (dateTo) {
      sql += ' AND date <= ?';
      values.push(dateTo);
    }
    
    const result = await query(sql, values);
    const row = result[0];
    
    const totalDays = parseInt(row.total_days) || 0;
    const presentDays = parseInt(row.present_days) || 0;
    const absentDays = parseInt(row.absent_days) || 0;
    const totalHours = parseFloat(row.total_hours) || 0;
    const avgHours = parseFloat(row.avg_hours) || 0;
    
    return {
      totalDays,
      presentDays,
      absentDays,
      totalHours,
      averageHoursPerDay: avgHours,
      attendancePercentage: totalDays > 0 ? (presentDays / totalDays) * 100 : 0
    };
  }

  // Get attendance statistics for a site
  static async getSiteAttendanceStats(siteId: string, date?: string): Promise<{
    totalWorkers: number;
    presentWorkers: number;
    absentWorkers: number;
    attendancePercentage: number;
    totalHours: number;
  }> {
    const dateFilter = date || new Date().toISOString().split('T')[0];
    
    const sql = `
      SELECT 
        COUNT(DISTINCT w.id) as total_workers,
        COUNT(DISTINCT CASE WHEN ar.status = 'PRESENT' THEN ar.worker_id END) as present_workers,
        COUNT(DISTINCT CASE WHEN ar.status = 'ABSENT' THEN ar.worker_id END) as absent_workers,
        COALESCE(SUM(ar.calculated_hours), 0) as total_hours
      FROM workers w
      LEFT JOIN attendance_records ar ON w.id = ar.worker_id AND ar.date = ?
      WHERE w.site_id = ? AND w.is_active = 1
    `;
    
    const result = await query(sql, [dateFilter, siteId]);
    const row = result[0];
    
    const totalWorkers = parseInt(row.total_workers) || 0;
    const presentWorkers = parseInt(row.present_workers) || 0;
    const absentWorkers = parseInt(row.absent_workers) || 0;
    const totalHours = parseFloat(row.total_hours) || 0;
    
    return {
      totalWorkers,
      presentWorkers,
      absentWorkers,
      attendancePercentage: totalWorkers > 0 ? (presentWorkers / totalWorkers) * 100 : 0,
      totalHours
    };
  }

  // Get total count for pagination
  static async getTotalCount(filters: AttendanceRecordFilters = {}): Promise<number> {
    let sql = 'SELECT COUNT(*) as count FROM attendance_records WHERE 1=1';
    const values: any[] = [];
    
    if (filters.site_id) {
      sql += ' AND site_id = ?';
      values.push(filters.site_id);
    }
    
    if (filters.worker_id) {
      sql += ' AND worker_id = ?';
      values.push(filters.worker_id);
    }

    if (filters.date_from) {
      sql += ' AND date >= ?';
      values.push(filters.date_from);
    }

    if (filters.date_to) {
      sql += ' AND date <= ?';
      values.push(filters.date_to);
    }

    if (filters.status) {
      sql += ' AND status = ?';
      values.push(filters.status);
    }

    if (filters.verified !== undefined) {
      sql += ' AND verified = ?';
      values.push(filters.verified ? 1 : 0);
    }
    
    const result = await query(sql, values);
    return result[0].count;
  }

  // Delete attendance record
  static async delete(id: string): Promise<boolean> {
    const sql = 'DELETE FROM attendance_records WHERE id = ?';
    const result = await run(sql, [id]);
    return (result.changes || 0) > 0;
  }
}
