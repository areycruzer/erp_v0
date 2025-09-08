import { query } from '../config/database';
import {
  AuditLog,
  CreateAuditLogInput,
  AuditLogFilters,
  AuditAction
} from '../types/database';

export class AuditRepository {
  // Create a new audit log entry
  static async create(auditData: CreateAuditLogInput): Promise<AuditLog> {
    // Generate a UUID-like ID using SQLite's randomblob
    const auditIdResult = await query('SELECT lower(hex(randomblob(16))) as id', []);
    const id = auditIdResult[0].id;
    
    const sql = `
      INSERT INTO audit_logs (id, entity_type, entity_id, action, changed_by, old_values, new_values, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const values = [
      id,
      auditData.entity_type,
      auditData.entity_id,
      auditData.action,
      auditData.changed_by,
      auditData.old_values ? JSON.stringify(auditData.old_values) : null,
      auditData.new_values ? JSON.stringify(auditData.new_values) : null,
      auditData.metadata ? JSON.stringify(auditData.metadata) : null
    ];
    
    await query(sql, values);
    
    // Get the created record by its ID
    const createdRecord = await this.findById(id);
    if (!createdRecord) {
      throw new Error('Failed to create audit log');
    }
    return createdRecord;
  }

  // Find audit log by ID
  static async findById(id: string): Promise<AuditLog | null> {
    const sql = 'SELECT * FROM audit_logs WHERE id = ?';
    const result = await query(sql, [id]);
    return result[0] || null;
  }

  // Get audit logs with filters
  static async findAll(filters: AuditLogFilters = {}, limit: number = 100, offset: number = 0): Promise<AuditLog[]> {
    let sql = 'SELECT * FROM audit_logs WHERE 1=1';
    const values: any[] = [];

    if (filters.entity_type) {
      sql += ` AND entity_type = ?`;
      values.push(filters.entity_type);
    }

    if (filters.entity_id) {
      sql += ` AND entity_id = ?`;
      values.push(filters.entity_id);
    }

    if (filters.action) {
      sql += ` AND action = ?`;
      values.push(filters.action);
    }

    if (filters.changed_by) {
      sql += ` AND changed_by = ?`;
      values.push(filters.changed_by);
    }

    if (filters.date_from) {
      sql += ` AND timestamp >= ?`;
      values.push(filters.date_from);
    }

    if (filters.date_to) {
      sql += ` AND timestamp <= ?`;
      values.push(filters.date_to);
    }

    sql += ' ORDER BY timestamp DESC';

    // Add limit and offset
    sql += ` LIMIT ?`;
    values.push(limit);

    sql += ` OFFSET ?`;
    values.push(offset);
    
    const result = await query(sql, values);
    return result;
  }

  // Get audit logs for a specific entity
  static async findByEntity(entityType: string, entityId: string, limit: number = 50): Promise<AuditLog[]> {
    const sql = `
      SELECT * FROM audit_logs 
      WHERE entity_type = ? AND entity_id = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `;
    
    const result = await query(sql, [entityType, entityId, limit]);
    return result;
  }

  // Get audit logs with user information
  static async findAllWithUserInfo(filters: AuditLogFilters = {}, limit: number = 100, offset: number = 0): Promise<Array<AuditLog & { user_name: string; user_email: string; user_role: string }>> {
    let sql = `
      SELECT 
        al.*,
        u.name as user_name,
        u.email as user_email,
        u.role as user_role
      FROM audit_logs al
      LEFT JOIN users u ON al.changed_by = u.id
      WHERE 1=1
    `;
    
    const values: any[] = [];

    if (filters.entity_type) {
      sql += ` AND al.entity_type = ?`;
      values.push(filters.entity_type);
    }

    if (filters.entity_id) {
      sql += ` AND al.entity_id = ?`;
      values.push(filters.entity_id);
    }

    if (filters.action) {
      sql += ` AND al.action = ?`;
      values.push(filters.action);
    }

    if (filters.changed_by) {
      sql += ` AND al.changed_by = ?`;
      values.push(filters.changed_by);
    }

    if (filters.date_from) {
      sql += ` AND al.timestamp >= ?`;
      values.push(filters.date_from);
    }

    if (filters.date_to) {
      sql += ` AND al.timestamp <= ?`;
      values.push(filters.date_to);
    }

    sql += ' ORDER BY al.timestamp DESC';

    // Add limit and offset
    sql += ` LIMIT ?`;
    values.push(limit);

    sql += ` OFFSET ?`;
    values.push(offset);
    
    const result = await query(sql, values);
    return result;
  }

  // Get audit statistics
  static async getStatistics(dateFrom?: Date, dateTo?: Date): Promise<{
    total_logs: number;
    logs_by_action: Record<AuditAction, number>;
    logs_by_entity_type: Record<string, number>;
    most_active_users: Array<{ user_id: string; user_name: string; log_count: number }>;
  }> {
    let whereClause = '';
    const values: any[] = [];

    if (dateFrom) {
      whereClause += ` AND timestamp >= ?`;
      values.push(dateFrom.toISOString());
    }

    if (dateTo) {
      whereClause += ` AND timestamp <= ?`;
      values.push(dateTo.toISOString());
    }

    // Get total logs
    const totalSql = `SELECT COUNT(*) as total FROM audit_logs WHERE 1=1${whereClause}`;
    const totalResult = await query(totalSql, values);
    const total_logs = parseInt(totalResult[0].total) || 0;

    // Get logs by action
    const actionSql = `
      SELECT action, COUNT(*) as count 
      FROM audit_logs 
      WHERE 1=1${whereClause}
      GROUP BY action
    `;
    const actionResult = await query(actionSql, values);
    const logs_by_action: Record<AuditAction, number> = {
      CREATE: 0,
      UPDATE: 0,
      DELETE: 0,
      APPROVE: 0
    };
    actionResult.forEach((row: any) => {
      logs_by_action[row.action as AuditAction] = parseInt(row.count);
    });

    // Get logs by entity type
    const entitySql = `
      SELECT entity_type, COUNT(*) as count 
      FROM audit_logs 
      WHERE 1=1${whereClause}
      GROUP BY entity_type
      ORDER BY count DESC
    `;
    const entityResult = await query(entitySql, values);
    const logs_by_entity_type: Record<string, number> = {};
    entityResult.forEach((row: any) => {
      logs_by_entity_type[row.entity_type] = parseInt(row.count);
    });

    // Get most active users
    const userSql = `
      SELECT 
        al.changed_by as user_id,
        u.name as user_name,
        COUNT(*) as log_count
      FROM audit_logs al
      LEFT JOIN users u ON al.changed_by = u.id
      WHERE 1=1${whereClause}
      GROUP BY al.changed_by, u.name
      ORDER BY log_count DESC
      LIMIT 10
    `;
    const userResult = await query(userSql, values);
    const most_active_users = userResult.map((row: any) => ({
      user_id: row.user_id?.toString() || 'Unknown',
      user_name: row.user_name || `User ${row.user_id}`,
      log_count: parseInt(row.log_count)
    }));

    return {
      total_logs,
      logs_by_action,
      logs_by_entity_type,
      most_active_users
    };
  }

  // Helper method to log entity changes
  static async logEntityChange(
    entityType: string,
    entityId: string,
    action: AuditAction,
    changedBy: string,
    oldValues?: Record<string, any>,
    newValues?: Record<string, any>,
    metadata?: Record<string, any>
  ): Promise<AuditLog> {
    return this.create({
      entity_type: entityType,
      entity_id: entityId,
      action,
      changed_by: changedBy,
      old_values: oldValues,
      new_values: newValues,
      metadata: metadata
    });
  }

  // Clean up old audit logs (for data retention)
  static async cleanupOldLogs(olderThanDays: number): Promise<number> {
    const sql = `
      DELETE FROM audit_logs 
      WHERE timestamp < NOW() - INTERVAL '${olderThanDays} days'
    `;
    
    const result = await query(sql);
    return result.changes || 0;
  }

  // Get count of audit logs matching filters
  static async getCount(filters: AuditLogFilters = {}): Promise<number> {
    let sql = 'SELECT COUNT(*) as count FROM audit_logs WHERE 1=1';
    const values: any[] = [];

    if (filters.entity_type) {
      sql += ` AND entity_type = ?`;
      values.push(filters.entity_type);
    }

    if (filters.entity_id) {
      sql += ` AND entity_id = ?`;
      values.push(filters.entity_id);
    }

    if (filters.action) {
      sql += ` AND action = ?`;
      values.push(filters.action);
    }

    if (filters.changed_by) {
      sql += ` AND changed_by = ?`;
      values.push(filters.changed_by);
    }

    if (filters.date_from) {
      sql += ` AND timestamp >= ?`;
      values.push(filters.date_from);
    }

    if (filters.date_to) {
      sql += ` AND timestamp <= ?`;
      values.push(filters.date_to);
    }
    
    const result = await query(sql, values);
    return parseInt(result[0].count) || 0;
  }
}