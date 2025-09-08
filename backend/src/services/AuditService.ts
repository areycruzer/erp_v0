import { AuditRepository } from '../repositories/AuditRepository';
import { AuditAction } from '../types/database';

export interface AuditContext {
  userId: string;
  userRole?: string;
  ipAddress?: string;
  userAgent?: string;
}

export class AuditService {
  /**
   * Log a data change event
   */
  static async logChange(
    entityType: string,
    entityId: string,
    action: AuditAction,
    context: AuditContext,
    oldValues?: Record<string, any>,
    newValues?: Record<string, any>,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      await AuditRepository.create({
        entity_type: entityType,
        entity_id: entityId,
        action,
        changed_by: context.userId,
        old_values: oldValues,
        new_values: newValues,
        metadata: {
          user_role: context.userRole,
          ip_address: context.ipAddress,
          user_agent: context.userAgent,
          timestamp: new Date().toISOString(),
          ...metadata
        }
      });
    } catch (error) {
      console.error('Failed to log audit event:', error);
      // Don't throw error to avoid breaking main functionality
    }
  }

  /**
   * Log a CREATE operation
   */
  static async logCreate(
    entityType: string,
    entityId: string,
    context: AuditContext,
    newValues: Record<string, any>,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.logChange(entityType, entityId, 'CREATE', context, undefined, newValues, metadata);
  }

  /**
   * Log an UPDATE operation
   */
  static async logUpdate(
    entityType: string,
    entityId: string,
    context: AuditContext,
    oldValues: Record<string, any>,
    newValues: Record<string, any>,
    metadata?: Record<string, any>
  ): Promise<void> {
    // Only log if there are actual changes
    const changes = this.calculateChanges(oldValues, newValues);
    if (Object.keys(changes).length > 0) {
      await this.logChange(entityType, entityId, 'UPDATE', context, oldValues, newValues, {
        changes,
        ...metadata
      });
    }
  }

  /**
   * Log a DELETE operation
   */
  static async logDelete(
    entityType: string,
    entityId: string,
    context: AuditContext,
    oldValues: Record<string, any>,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.logChange(entityType, entityId, 'DELETE', context, oldValues, undefined, metadata);
  }

  /**
   * Log an APPROVE operation (for attendance records)
   */
  static async logApprove(
    entityType: string,
    entityId: string,
    context: AuditContext,
    oldValues: Record<string, any>,
    newValues: Record<string, any>,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.logChange(entityType, entityId, 'APPROVE', context, oldValues, newValues, metadata);
  }

  /**
   * Calculate what fields actually changed between old and new values
   */
  private static calculateChanges(oldValues: Record<string, any>, newValues: Record<string, any>): Record<string, { from: any, to: any }> {
    const changes: Record<string, { from: any, to: any }> = {};
    
    // Check for changed fields
    for (const key in newValues) {
      if (oldValues[key] !== newValues[key]) {
        changes[key] = {
          from: oldValues[key],
          to: newValues[key]
        };
      }
    }
    
    // Check for removed fields
    for (const key in oldValues) {
      if (!(key in newValues)) {
        changes[key] = {
          from: oldValues[key],
          to: null
        };
      }
    }
    
    return changes;
  }

  /**
   * Extract audit context from Express request
   */
  static extractContext(req: any): AuditContext {
    return {
      userId: req.user?.userId || 'system',
      userRole: req.user?.role,
      ipAddress: req.ip || req.connection?.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown'
    };
  }

  /**
   * Get audit trail for a specific entity
   */
  static async getEntityAuditTrail(
    entityType: string,
    entityId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<any[]> {
    try {
      const auditLogs = await AuditRepository.findAll({
        entity_type: entityType,
        entity_id: entityId
      }, limit, offset);

      return auditLogs;
    } catch (error) {
      console.error('Failed to get audit trail:', error);
      return [];
    }
  }

  /**
   * Get system-wide audit logs with filtering
   */
  static async getSystemAuditLogs(filters: {
    entity_type?: string;
    action?: AuditAction;
    changed_by?: string;
    date_from?: string;
    date_to?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ logs: any[], total: number }> {
    try {
      const { limit = 100, offset = 0, date_from, date_to, ...auditFilters } = filters;
      
      // Convert date strings to Date objects if provided
      const finalFilters: any = { ...auditFilters };
      if (date_from) {
        finalFilters.date_from = new Date(date_from);
      }
      if (date_to) {
        finalFilters.date_to = new Date(date_to);
      }
      
      const logs = await AuditRepository.findAll(finalFilters, limit, offset);
      const total = await AuditRepository.getCount(finalFilters);

      return { logs, total };
    } catch (error) {
      console.error('Failed to get system audit logs:', error);
      return { logs: [], total: 0 };
    }
  }
}
