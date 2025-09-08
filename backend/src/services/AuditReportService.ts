import { AuditRepository } from '../repositories/AuditRepository';
import * as fs from 'fs';
import * as path from 'path';

export interface ReportFilters {
  startDate?: string;
  endDate?: string;
  userId?: number;
  entityType?: string;
  action?: string;
  limit?: number;
}

export interface ReportOptions {
  title?: string;
  includeDetails?: boolean;
  groupBy?: 'user' | 'date' | 'action' | 'entity';
  format: 'csv' | 'pdf' | 'json';
}

export interface UserActivitySummary {
  userId: number;
  userName: string;
  totalActions: number;
  actionBreakdown: Record<string, number>;
  lastActivity: string;
}

export interface ComplianceReport {
  reportId: string;
  generatedAt: string;
  filters: ReportFilters;
  summary: {
    totalLogs: number;
    dateRange: { start: string; end: string };
    uniqueUsers: number;
    actionTypes: Record<string, number>;
    entityTypes: Record<string, number>;
  };
  logs: any[];
  userActivities?: UserActivitySummary[];
}

export class AuditReportService {
  // Using static methods from AuditRepository, so no need for instance
  // constructor(private auditRepository: AuditRepository) {}

  /**
   * Generate comprehensive audit report with specified filters and format
   */
  async generateReport(
    filters: ReportFilters,
    options: ReportOptions
  ): Promise<{ filePath: string; report: ComplianceReport }> {
    const reportId = `audit_report_${Date.now()}`;
    const report = await this.buildComplianceReport(filters, reportId);

    // Ensure reports directory exists
    const reportsDir = path.join(process.cwd(), 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    let filePath: string;
    
    switch (options.format) {
      case 'csv':
        filePath = await this.generateCSVReport(report, options, reportsDir);
        break;
      case 'pdf':
        filePath = await this.generatePDFReport(report, options, reportsDir);
        break;
      case 'json':
        filePath = await this.generateJSONReport(report, options, reportsDir);
        break;
      default:
        throw new Error(`Unsupported report format: ${options.format}`);
    }

    return { filePath, report };
  }

  /**
   * Build comprehensive compliance report with analytics
   */
  private async buildComplianceReport(
    filters: ReportFilters,
    reportId: string
  ): Promise<ComplianceReport> {
    // Convert filters to AuditLogFilters format, only including defined values
    const auditFilters: any = {};
    if (filters.entityType) auditFilters.entity_type = filters.entityType;
    if (filters.action) auditFilters.action = filters.action;
    if (filters.userId) auditFilters.changed_by = filters.userId;
    if (filters.startDate) auditFilters.date_from = filters.startDate;
    if (filters.endDate) auditFilters.date_to = filters.endDate;

    // Get audit logs with filters using findAllWithUserInfo for better data
    const logs = await AuditRepository.findAllWithUserInfo(
      auditFilters,
      filters.limit || 10000,
      0
    );

    // Calculate summary statistics
    const summary = this.calculateSummary(logs, filters);
    
    // Generate user activity summaries
    const userActivities = await this.generateUserActivitySummaries(logs);

    return {
      reportId,
      generatedAt: new Date().toISOString(),
      filters,
      summary,
      logs,
      userActivities
    };
  }

  /**
   * Calculate summary statistics for the report
   */
  private calculateSummary(logs: any[], filters: ReportFilters) {
    const actionTypes: Record<string, number> = {};
    const entityTypes: Record<string, number> = {};
    const userIds = new Set<number>();

    logs.forEach(log => {
      // Count actions
      actionTypes[log.action] = (actionTypes[log.action] || 0) + 1;
      
      // Count entity types
      entityTypes[log.entity_type] = (entityTypes[log.entity_type] || 0) + 1;
      
      // Track unique users
      if (log.changed_by) userIds.add(log.changed_by);
    });

    // Determine date range
    const dates = logs.map(log => new Date(log.timestamp)).sort();
    const dateRange = {
      start: dates.length > 0 ? dates[0].toISOString() : (filters.startDate || ''),
      end: dates.length > 0 ? dates[dates.length - 1].toISOString() : (filters.endDate || '')
    };

    return {
      totalLogs: logs.length,
      dateRange,
      uniqueUsers: userIds.size,
      actionTypes,
      entityTypes
    };
  }

  /**
   * Generate user activity summaries
   */
  private async generateUserActivitySummaries(logs: any[]): Promise<UserActivitySummary[]> {
    const userMap = new Map<number, UserActivitySummary>();

    logs.forEach(log => {
      if (!log.changed_by) return;

      if (!userMap.has(log.changed_by)) {
        userMap.set(log.changed_by, {
          userId: log.changed_by,
          userName: log.changed_by_name || `User ${log.changed_by}`,
          totalActions: 0,
          actionBreakdown: {},
          lastActivity: log.timestamp
        });
      }

      const summary = userMap.get(log.changed_by)!;
      summary.totalActions++;
      summary.actionBreakdown[log.action] = (summary.actionBreakdown[log.action] || 0) + 1;
      
      // Update last activity if this log is more recent
      if (new Date(log.timestamp) > new Date(summary.lastActivity)) {
        summary.lastActivity = log.timestamp;
      }
    });

    return Array.from(userMap.values()).sort((a, b) => b.totalActions - a.totalActions);
  }

  /**
   * Generate CSV format report
   */
  private async generateCSVReport(
    report: ComplianceReport,
    options: ReportOptions,
    reportsDir: string
  ): Promise<string> {
    const fileName = `${report.reportId}.csv`;
    const filePath = path.join(reportsDir, fileName);

    let csvContent = '';

    // Add header information
    csvContent += `Audit Report,${report.reportId}\n`;
    csvContent += `Generated At,${new Date(report.generatedAt).toLocaleString()}\n`;
    csvContent += `Total Logs,${report.summary.totalLogs}\n`;
    csvContent += `Unique Users,${report.summary.uniqueUsers}\n`;
    csvContent += `Date Range,"${report.summary.dateRange.start}" to "${report.summary.dateRange.end}"\n`;
    csvContent += `\n`;

    // Add audit logs
    csvContent += `ID,Timestamp,Action,Entity Type,Entity ID,Changed By,Changed By Name,Old Values,New Values,Context\n`;
    
    report.logs.forEach(log => {
      const row = [
        log.id,
        log.timestamp,
        log.action,
        log.entity_type,
        log.entity_id || '',
        log.changed_by || '',
        log.changed_by_name || '',
        this.escapeCsvField(log.old_values),
        this.escapeCsvField(log.new_values),
        this.escapeCsvField(log.context)
      ].join(',');
      csvContent += row + '\n';
    });

    // Add user activity summary if requested
    if (options.includeDetails && report.userActivities) {
      csvContent += `\nUser Activity Summary\n`;
      csvContent += `User ID,User Name,Total Actions,Action Breakdown,Last Activity\n`;
      
      report.userActivities.forEach(activity => {
        const actionBreakdown = Object.entries(activity.actionBreakdown)
          .map(([action, count]) => `${action}:${count}`)
          .join(';');
        
        const row = [
          activity.userId,
          activity.userName,
          activity.totalActions,
          this.escapeCsvField(actionBreakdown),
          activity.lastActivity
        ].join(',');
        csvContent += row + '\n';
      });
    }

    fs.writeFileSync(filePath, csvContent, 'utf-8');
    return filePath;
  }

  /**
   * Generate PDF format report (simplified HTML-to-PDF conversion)
   */
  private async generatePDFReport(
    report: ComplianceReport,
    options: ReportOptions,
    reportsDir: string
  ): Promise<string> {
    // For now, generate HTML that can be converted to PDF
    // In production, you might use libraries like puppeteer or jsPDF
    const fileName = `${report.reportId}.html`;
    const filePath = path.join(reportsDir, fileName);

    const title = options.title || 'Audit Compliance Report';
    
    let htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>${title}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
        .summary { background: #f5f5f5; padding: 15px; margin-bottom: 20px; }
        .summary-item { margin: 5px 0; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .actions { font-size: 12px; }
        .user-summary { margin-top: 30px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${title}</h1>
        <p>Report ID: ${report.reportId}</p>
        <p>Generated: ${new Date(report.generatedAt).toLocaleString()}</p>
    </div>

    <div class="summary">
        <h2>Summary</h2>
        <div class="summary-item"><strong>Total Audit Logs:</strong> ${report.summary.totalLogs}</div>
        <div class="summary-item"><strong>Unique Users:</strong> ${report.summary.uniqueUsers}</div>
        <div class="summary-item"><strong>Date Range:</strong> ${new Date(report.summary.dateRange.start).toLocaleDateString()} to ${new Date(report.summary.dateRange.end).toLocaleDateString()}</div>
        <div class="summary-item"><strong>Action Types:</strong> ${Object.entries(report.summary.actionTypes).map(([action, count]) => `${action} (${count})`).join(', ')}</div>
        <div class="summary-item"><strong>Entity Types:</strong> ${Object.entries(report.summary.entityTypes).map(([entity, count]) => `${entity} (${count})`).join(', ')}</div>
    </div>

    <h2>Audit Log Details</h2>
    <table>
        <thead>
            <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Changed By</th>
                <th>Changes</th>
            </tr>
        </thead>
        <tbody>`;

    report.logs.slice(0, 100).forEach(log => { // Limit for PDF readability
      htmlContent += `
            <tr>
                <td>${new Date(log.timestamp).toLocaleString()}</td>
                <td>${log.action}</td>
                <td>${log.entity_type} ${log.entity_id || ''}</td>
                <td>${log.changed_by_name || log.changed_by || 'System'}</td>
                <td class="actions">${this.formatChangesForHTML(log)}</td>
            </tr>`;
    });

    htmlContent += `
        </tbody>
    </table>`;

    // Add user activity summary if requested
    if (options.includeDetails && report.userActivities) {
      htmlContent += `
    <div class="user-summary">
        <h2>User Activity Summary</h2>
        <table>
            <thead>
                <tr>
                    <th>User</th>
                    <th>Total Actions</th>
                    <th>Action Breakdown</th>
                    <th>Last Activity</th>
                </tr>
            </thead>
            <tbody>`;

      report.userActivities.slice(0, 20).forEach(activity => {
        const actionBreakdown = Object.entries(activity.actionBreakdown)
          .map(([action, count]) => `${action}: ${count}`)
          .join('<br>');
        
        htmlContent += `
                <tr>
                    <td>${activity.userName}</td>
                    <td>${activity.totalActions}</td>
                    <td class="actions">${actionBreakdown}</td>
                    <td>${new Date(activity.lastActivity).toLocaleString()}</td>
                </tr>`;
      });

      htmlContent += `
            </tbody>
        </table>
    </div>`;
    }

    htmlContent += `
</body>
</html>`;

    fs.writeFileSync(filePath, htmlContent, 'utf-8');
    return filePath;
  }

  /**
   * Generate JSON format report
   */
  private async generateJSONReport(
    report: ComplianceReport,
    _options: ReportOptions,
    reportsDir: string
  ): Promise<string> {
    const fileName = `${report.reportId}.json`;
    const filePath = path.join(reportsDir, fileName);

    fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf-8');
    return filePath;
  }

  /**
   * Escape CSV field content
   */
  private escapeCsvField(value: any): string {
    if (value === null || value === undefined) return '';
    
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    
    // Escape quotes and wrap in quotes if contains comma, quote, or newline
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return '"' + stringValue.replace(/"/g, '""') + '"';
    }
    
    return stringValue;
  }

  /**
   * Format changes for HTML display
   */
  private formatChangesForHTML(log: any): string {
    const changes: string[] = [];
    
    if (log.old_values && log.new_values) {
      try {
        const oldVals = typeof log.old_values === 'string' ? JSON.parse(log.old_values) : log.old_values;
        const newVals = typeof log.new_values === 'string' ? JSON.parse(log.new_values) : log.new_values;
        
        Object.keys(newVals).forEach(key => {
          if (oldVals[key] !== newVals[key]) {
            changes.push(`${key}: ${oldVals[key]} → ${newVals[key]}`);
          }
        });
      } catch (e) {
        changes.push('Changes available in raw data');
      }
    } else if (log.new_values) {
      changes.push('New record created');
    }

    return changes.length > 0 ? changes.join('<br>') : log.action;
  }

  /**
   * Generate user activity report for specific user
   */
  async generateUserActivityReport(
    userId: number,
    startDate?: string,
    endDate?: string,
    format: 'csv' | 'json' = 'json'
  ): Promise<{ filePath: string; summary: UserActivitySummary }> {
    // Build filters object only with defined values
    const auditFilters: any = { changed_by: userId };
    if (startDate) auditFilters.date_from = startDate;
    if (endDate) auditFilters.date_to = endDate;

    const logs = await AuditRepository.findAllWithUserInfo(
      auditFilters,
      10000,
      0
    );

    const userActivities = await this.generateUserActivitySummaries(logs);
    const userSummary = userActivities.find(u => u.userId === userId);

    if (!userSummary) {
      throw new Error(`No activity found for user ${userId}`);
    }

    const reportsDir = path.join(process.cwd(), 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const reportData = {
      userId,
      summary: userSummary,
      logs,
      generatedAt: new Date().toISOString(),
      dateRange: { startDate, endDate }
    };

    const fileName = `user_activity_${userId}_${Date.now()}.${format}`;
    const filePath = path.join(reportsDir, fileName);

    if (format === 'csv') {
      let csvContent = `User Activity Report for ${userSummary.userName}\n`;
      csvContent += `Generated At,${new Date().toLocaleString()}\n`;
      csvContent += `Total Actions,${userSummary.totalActions}\n`;
      csvContent += `Last Activity,${new Date(userSummary.lastActivity).toLocaleString()}\n\n`;
      
      csvContent += `Timestamp,Action,Entity Type,Entity ID,Changes\n`;
      logs.forEach((log: any) => {
        csvContent += `${log.timestamp},${log.action},${log.entity_type},${log.entity_id || ''},${this.escapeCsvField(log.new_values || log.old_values)}\n`;
      });

      fs.writeFileSync(filePath, csvContent, 'utf-8');
    } else {
      fs.writeFileSync(filePath, JSON.stringify(reportData, null, 2), 'utf-8');
    }

    return { filePath, summary: userSummary };
  }
}
