import { query, run } from '../config/database';
import {
  NewAttendanceRecord,
  CreateNewAttendanceInput,
  UpdateNewAttendanceInput
} from '../types/database';
import { AuditService, AuditContext } from '../services/AuditService';

export class NewAttendanceRepository {
  // Create a new attendance record
  static async create(recordData: CreateNewAttendanceInput, auditContext?: AuditContext): Promise<NewAttendanceRecord> {
    const sql = `
      INSERT INTO new_attendance_records (
        id, worker_id, site_id, date, P, A, HD, 
        interpretation_mode, submitted_by, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const recordId = `att-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const values = [
      recordId,
      recordData.worker_id,
      recordData.site_id,
      recordData.date,
      recordData.P,
      recordData.A,
      recordData.HD,
      recordData.interpretation_mode,
      recordData.submitted_by,
      recordData.status
    ];
    
    await run(sql, values);
    const createdRecord = await this.findById(recordId);
    if (!createdRecord) {
      throw new Error('Failed to create attendance record');
    }

    // Log audit event
    if (auditContext) {
      await AuditService.logCreate(
        'new_attendance_record',
        recordId,
        auditContext,
        createdRecord as any,
        { entity_name: `Attendance for worker ${recordData.worker_id} on ${recordData.date}` }
      );
    }

    return createdRecord;
  }

  // Find attendance record by ID
  static async findById(id: string): Promise<NewAttendanceRecord | null> {
    const sql = 'SELECT * FROM new_attendance_records WHERE id = ?';
    const result = await query(sql, [id]);
    return result[0] || null;
  }

  // Find all records with optional filters
  static async findAll(filters: {
    site_id?: string;
    worker_id?: string;
    date?: string;
    status?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ attendance: NewAttendanceRecord[]; total: number }> {
    let sql = 'SELECT * FROM new_attendance_records WHERE 1=1';
    const params: any[] = [];

    if (filters.site_id) {
      sql += ' AND site_id = ?';
      params.push(filters.site_id);
    }

    if (filters.worker_id) {
      sql += ' AND worker_id = ?';
      params.push(filters.worker_id);
    }

    if (filters.date) {
      sql += ' AND date = ?';
      params.push(filters.date);
    }

    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }

    // Get total count
    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as count');
    const countResult = await query(countSql, params);
    const total = countResult[0]?.count || 0;

    // Add ordering and pagination
    sql += ' ORDER BY created_at DESC';
    
    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
    }

    if (filters.offset) {
      sql += ' OFFSET ?';
      params.push(filters.offset);
    }

    const attendance = await query(sql, params);
    return { attendance, total };
  }

  // Update attendance record
  static async update(id: string, updateData: UpdateNewAttendanceInput, auditContext?: AuditContext): Promise<NewAttendanceRecord | null> {
    // Get old values for audit
    const oldRecord = await this.findById(id);
    if (!oldRecord) {
      return null;
    }

    const setParts: string[] = [];
    const params: any[] = [];

    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined) {
        setParts.push(`${key} = ?`);
        params.push(value);
      }
    });

    if (setParts.length === 0) {
      return this.findById(id);
    }

    const sql = `
      UPDATE new_attendance_records 
      SET ${setParts.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    params.push(id);
    await run(sql, params);
    
    const updatedRecord = await this.findById(id);

    // Log audit event
    if (auditContext && updatedRecord) {
      await AuditService.logUpdate(
        'new_attendance_record',
        id,
        auditContext,
        oldRecord as any,
        updatedRecord as any,
        { entity_name: `Attendance for worker ${oldRecord.worker_id} on ${oldRecord.date}` }
      );
    }

    return updatedRecord;
  }

  // Approve attendance record
  static async approve(id: string, approvedBy: string, auditContext?: AuditContext): Promise<NewAttendanceRecord | null> {
    // Get old values for audit
    const oldRecord = await this.findById(id);
    if (!oldRecord) {
      return null;
    }

    const sql = `
      UPDATE new_attendance_records 
      SET status = 'APPROVED', approved_by = ?, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    await run(sql, [approvedBy, id]);
    const updatedRecord = await this.findById(id);

    // Log audit event
    if (auditContext && updatedRecord) {
      await AuditService.logApprove(
        'new_attendance_record',
        id,
        auditContext,
        oldRecord as any,
        updatedRecord as any,
        { 
          entity_name: `Attendance for worker ${oldRecord.worker_id} on ${oldRecord.date}`,
          action_type: 'approval'
        }
      );
    }

    return updatedRecord;
  }

  // Reject attendance record
  static async reject(id: string, approvedBy: string, auditContext?: AuditContext): Promise<NewAttendanceRecord | null> {
    // Get old values for audit
    const oldRecord = await this.findById(id);
    if (!oldRecord) {
      return null;
    }

    const sql = `
      UPDATE new_attendance_records 
      SET status = 'REJECTED', approved_by = ?, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    await run(sql, [approvedBy, id]);
    const updatedRecord = await this.findById(id);

    // Log audit event
    if (auditContext && updatedRecord) {
      await AuditService.logApprove(
        'new_attendance_record',
        id,
        auditContext,
        oldRecord as any,
        updatedRecord as any,
        { 
          entity_name: `Attendance for worker ${oldRecord.worker_id} on ${oldRecord.date}`,
          action_type: 'rejection'
        }
      );
    }

    return updatedRecord;
  }

  // Delete attendance record
  static async delete(id: string): Promise<boolean> {
    const sql = 'DELETE FROM new_attendance_records WHERE id = ?';
    const result = await run(sql, [id]);
    return result.changes > 0;
  }

  // Get pending approvals for a site incharge (filtered by their assigned sites)
  static async getPendingApprovals(siteInchargeId?: string): Promise<NewAttendanceRecord[]> {
    let sql = `
      SELECT nar.* 
      FROM new_attendance_records nar
      WHERE nar.status = 'PENDING'
    `;
    const params: any[] = [];

    // If site incharge is specified, filter by their assigned sites
    if (siteInchargeId) {
      sql += `
        AND nar.site_id IN (
          SELECT usa.site_id 
          FROM user_site_assignments usa 
          WHERE usa.user_id = ?
        )
      `;
      params.push(siteInchargeId);
    }

    sql += ' ORDER BY nar.created_at ASC';
    
    return await query(sql, params);
  }

  // Check if attendance exists for worker and date
  static async findByWorkerAndDate(workerId: string, date: string): Promise<NewAttendanceRecord | null> {
    const sql = 'SELECT * FROM new_attendance_records WHERE worker_id = ? AND date = ?';
    const result = await query(sql, [workerId, date]);
    return result[0] || null;
  }
}
