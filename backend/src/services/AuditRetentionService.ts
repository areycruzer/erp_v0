import { query, run } from '../config/database';

export interface RetentionPolicy {
  // How many days to keep audit logs
  retentionDays: number;
  
  // Whether to archive before deletion
  enableArchiving: boolean;
  
  // Archive file path (if archiving enabled)
  archivePath?: string;
  
  // Batch size for deletion (to avoid long-running transactions)
  batchSize: number;
}

export class AuditRetentionService {
  private static readonly DEFAULT_RETENTION_DAYS = 365; // 1 year
  private static readonly DEFAULT_BATCH_SIZE = 1000;

  /**
   * Clean up old audit logs based on retention policy
   */
  static async cleanupOldLogs(policy?: Partial<RetentionPolicy>): Promise<{
    deletedCount: number;
    archivedCount: number;
    errors: string[];
  }> {
    const config = {
      retentionDays: policy?.retentionDays || this.DEFAULT_RETENTION_DAYS,
      enableArchiving: policy?.enableArchiving || false,
      archivePath: policy?.archivePath,
      batchSize: policy?.batchSize || this.DEFAULT_BATCH_SIZE
    };

    const result = {
      deletedCount: 0,
      archivedCount: 0,
      errors: [] as string[]
    };

    try {
      console.log(`🧹 Starting audit log cleanup with ${config.retentionDays} day retention...`);

      // Calculate cutoff date
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - config.retentionDays);
      const cutoffISO = cutoffDate.toISOString();

      // Get count of logs to be cleaned up
      const countSql = `
        SELECT COUNT(*) as count 
        FROM audit_logs 
        WHERE timestamp < ?
      `;
      const countResult = await query(countSql, [cutoffISO]);
      const totalToCleanup = countResult[0].count;

      if (totalToCleanup === 0) {
        console.log('✅ No audit logs need cleanup');
        return result;
      }

      console.log(`📊 Found ${totalToCleanup} audit logs older than ${config.retentionDays} days`);

      // Archive logs if enabled
      if (config.enableArchiving) {
        try {
          const archivedCount = await this.archiveOldLogs(cutoffISO, config.archivePath);
          result.archivedCount = archivedCount;
          console.log(`📦 Archived ${archivedCount} audit logs`);
        } catch (error) {
          const errorMsg = `Failed to archive logs: ${error instanceof Error ? error.message : 'Unknown error'}`;
          result.errors.push(errorMsg);
          console.error('❌', errorMsg);
        }
      }

      // Delete logs in batches
      let totalDeleted = 0;
      while (totalDeleted < totalToCleanup) {
        try {
          const deleteSql = `
            DELETE FROM audit_logs 
            WHERE id IN (
              SELECT id FROM audit_logs 
              WHERE timestamp < ? 
              ORDER BY timestamp ASC 
              LIMIT ?
            )
          `;
          
          const deleteResult = await run(deleteSql, [cutoffISO, config.batchSize]);
          const batchDeleted = deleteResult.changes || 0;
          
          if (batchDeleted === 0) {
            break; // No more records to delete
          }
          
          totalDeleted += batchDeleted;
          console.log(`🗑️  Deleted batch: ${batchDeleted} logs (total: ${totalDeleted}/${totalToCleanup})`);

          // Small delay between batches to avoid overwhelming the database
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          const errorMsg = `Batch deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
          result.errors.push(errorMsg);
          console.error('❌', errorMsg);
          break;
        }
      }

      result.deletedCount = totalDeleted;
      console.log(`✅ Cleanup completed: ${totalDeleted} logs deleted, ${result.archivedCount} archived`);

    } catch (error) {
      const errorMsg = `Cleanup process failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      result.errors.push(errorMsg);
      console.error('❌', errorMsg);
    }

    return result;
  }

  /**
   * Archive old audit logs to file before deletion
   */
  private static async archiveOldLogs(cutoffDate: string, archivePath?: string): Promise<number> {
    const fs = require('fs').promises;
    const path = require('path');

    // Default archive path
    const defaultArchivePath = path.join(process.cwd(), 'data', 'audit-archives');
    const finalArchivePath = archivePath || defaultArchivePath;

    // Ensure archive directory exists
    await fs.mkdir(finalArchivePath, { recursive: true });

    // Get logs to archive with user information
    const archiveSql = `
      SELECT 
        al.*,
        u.name as user_name,
        u.email as user_email
      FROM audit_logs al
      LEFT JOIN users u ON al.changed_by = u.id
      WHERE al.timestamp < ?
      ORDER BY al.timestamp ASC
    `;

    const logsToArchive = await query(archiveSql, [cutoffDate]);

    if (logsToArchive.length === 0) {
      return 0;
    }

    // Create archive file with timestamp
    const archiveDate = new Date().toISOString().split('T')[0];
    const archiveFileName = `audit-logs-archive-${archiveDate}.json`;
    const archiveFilePath = path.join(finalArchivePath, archiveFileName);

    // Prepare archive data with metadata
    const archiveData = {
      metadata: {
        archiveDate: new Date().toISOString(),
        cutoffDate,
        recordCount: logsToArchive.length,
        schemaVersion: '1.0'
      },
      logs: logsToArchive.map((log: any) => ({
        ...log,
        // Parse JSON fields for better readability
        old_values: log.old_values ? JSON.parse(log.old_values) : null,
        new_values: log.new_values ? JSON.parse(log.new_values) : null,
        metadata: log.metadata ? JSON.parse(log.metadata) : null
      }))
    };

    // Write archive file
    await fs.writeFile(archiveFilePath, JSON.stringify(archiveData, null, 2), 'utf8');
    console.log(`📁 Archive saved: ${archiveFilePath}`);

    return logsToArchive.length;
  }

  /**
   * Get audit log statistics for retention planning
   */
  static async getRetentionStatistics(): Promise<{
    totalLogs: number;
    oldestLog: Date | null;
    newestLog: Date | null;
    logsByAge: Array<{ days: number; count: number }>;
    estimatedDiskUsage: string;
  }> {
    try {
      // Total count
      const totalResult = await query('SELECT COUNT(*) as count FROM audit_logs', []);
      const totalLogs = totalResult[0].count;

      // Date range
      const dateRangeResult = await query(
        'SELECT MIN(timestamp) as oldest, MAX(timestamp) as newest FROM audit_logs',
        []
      );
      const oldestLog = dateRangeResult[0].oldest ? new Date(dateRangeResult[0].oldest) : null;
      const newestLog = dateRangeResult[0].newest ? new Date(dateRangeResult[0].newest) : null;

      // Logs by age groups
      const ageGroups = [7, 30, 90, 180, 365, 730]; // days
      const logsByAge = [];

      for (const days of ageGroups) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        
        const ageResult = await query(
          'SELECT COUNT(*) as count FROM audit_logs WHERE timestamp < ?',
          [cutoffDate.toISOString()]
        );
        
        logsByAge.push({
          days,
          count: ageResult[0].count
        });
      }

      // Estimate disk usage (rough calculation)
      const avgLogSize = 1024; // Estimated 1KB per log entry
      const estimatedBytes = totalLogs * avgLogSize;
      const estimatedDiskUsage = formatBytes(estimatedBytes);

      return {
        totalLogs,
        oldestLog,
        newestLog,
        logsByAge,
        estimatedDiskUsage
      };

    } catch (error) {
      console.error('Failed to get retention statistics:', error);
      return {
        totalLogs: 0,
        oldestLog: null,
        newestLog: null,
        logsByAge: [],
        estimatedDiskUsage: '0 B'
      };
    }
  }

  /**
   * Scheduled cleanup job (can be called by cron or scheduler)
   */
  static async scheduledCleanup(retentionDays: number = 365): Promise<void> {
    console.log(`⏰ Starting scheduled audit log cleanup (${retentionDays} day retention)...`);
    
    const result = await this.cleanupOldLogs({
      retentionDays,
      enableArchiving: true,
      batchSize: 1000
    });

    if (result.errors.length > 0) {
      console.error('⚠️ Cleanup completed with errors:', result.errors);
    } else {
      console.log(`✅ Scheduled cleanup completed successfully: ${result.deletedCount} deleted, ${result.archivedCount} archived`);
    }
  }
}

// Helper function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
