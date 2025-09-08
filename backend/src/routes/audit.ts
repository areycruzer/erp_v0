import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { AuditRepository } from '../repositories/AuditRepository';
import { AuditRetentionService } from '../services/AuditRetentionService';
import { AuditReportService } from '../services/AuditReportService';
import { auditScheduleService } from '../services/AuditScheduleService';
import { AuditAnalyticsService } from '../services/AuditAnalyticsService';
import { authenticate } from '../middleware/auth';
import { checkRole } from '../middleware/rbac';
import * as path from 'path';

const router = express.Router();

// Validation middleware
const handleValidationErrors = (req: express.Request, res: express.Response, next: express.NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
    return;
  }
  next();
};

// GET /audit/logs - Get audit logs with filtering and pagination
router.get('/logs', 
  authenticate,
  checkRole(['ADMIN']), // Only admins can view audit logs
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('table_name').optional().isString().withMessage('Table name must be a string'),
    query('operation').optional().isIn(['CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT']).withMessage('Invalid operation'),
    query('user_id').optional().isInt().withMessage('User ID must be an integer'),
    query('date_from').optional().isISO8601().withMessage('Invalid start date format'),
    query('date_to').optional().isISO8601().withMessage('Invalid end date format'),
  ],
  handleValidationErrors,
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { 
        page = 1, 
        limit = 50,
        table_name,
        operation,
        user_id,
        date_from,
        date_to
      } = req.query as any;
      
      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
      
      const filters = {
        entity_type: table_name,
        action: operation,
        changed_by: user_id ? user_id.toString() : undefined,
        date_from,
        date_to
      };

      const total = await AuditRepository.getCount(filters);
      const logs = await AuditRepository.findAllWithUserInfo(filters, parseInt(limit as string), offset);

      res.json({
        success: true,
        data: {
          logs,
          pagination: {
            page: parseInt(page as string),
            limit: parseInt(limit as string),
            total,
            totalPages: Math.ceil(total / parseInt(limit as string))
          }
        }
      });
    } catch (error) {
      console.error('❌ Error fetching audit logs:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch audit logs',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// GET /audit/logs/:id - Get specific audit log details
router.get('/logs/:id',
  authenticate,
  checkRole(['ADMIN']),
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { id } = req.params;
      const log = await AuditRepository.findById(id);
      
      if (!log) {
        res.status(404).json({
          success: false,
          message: 'Audit log not found'
        });
        return;
      }

      res.json({
        success: true,
        data: log
      });
    } catch (error) {
      console.error('❌ Error fetching audit log:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch audit log',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// GET /audit/summary - Get audit summary statistics
router.get('/summary',
  authenticate,
  checkRole(['ADMIN']),
  [
    query('days').optional().isInt({ min: 1, max: 365 }).withMessage('Days must be between 1 and 365'),
  ],
  handleValidationErrors,
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { days = 30 } = req.query as any;
      const summary = await AuditRepository.getStatistics(
        new Date(Date.now() - parseInt(days as string) * 24 * 60 * 60 * 1000),
        new Date()
      );

      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      console.error('❌ Error fetching audit summary:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch audit summary',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// GET /audit/retention/stats - Get retention statistics
router.get('/retention/stats',
  authenticate,
  checkRole(['ADMIN']),
  async (_req: express.Request, res: express.Response): Promise<void> => {
    try {
      const stats = await AuditRetentionService.getRetentionStatistics();

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('❌ Error fetching retention statistics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch retention statistics',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// POST /audit/retention/cleanup - Manually trigger cleanup
router.post('/retention/cleanup',
  authenticate,
  checkRole(['ADMIN']),
  [
    body('retentionDays').optional().isInt({ min: 1, max: 3650 }).withMessage('Retention days must be between 1 and 3650'),
    body('enableArchiving').optional().isBoolean().withMessage('Enable archiving must be boolean'),
    body('batchSize').optional().isInt({ min: 100, max: 10000 }).withMessage('Batch size must be between 100 and 10000'),
  ],
  handleValidationErrors,
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { retentionDays, enableArchiving, batchSize } = req.body;

      const result = await AuditRetentionService.cleanupOldLogs({
        retentionDays,
        enableArchiving,
        batchSize
      });

      res.json({
        success: true,
        data: result,
        message: `Cleanup completed: ${result.deletedCount} logs deleted, ${result.archivedCount} archived`
      });
    } catch (error) {
      console.error('❌ Error during manual cleanup:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to perform cleanup',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// POST /audit/reports/generate - Generate audit report
router.post('/reports/generate',
  authenticate,
  checkRole(['ADMIN']),
  [
    body('format').isIn(['csv', 'pdf', 'json']).withMessage('Format must be csv, pdf, or json'),
    body('startDate').optional().isISO8601().withMessage('Invalid start date format'),
    body('endDate').optional().isISO8601().withMessage('Invalid end date format'),
    body('userId').optional().isInt().withMessage('User ID must be an integer'),
    body('entityType').optional().isString().withMessage('Entity type must be a string'),
    body('action').optional().isString().withMessage('Action must be a string'),
    body('limit').optional().isInt({ min: 1, max: 50000 }).withMessage('Limit must be between 1 and 50000'),
    body('title').optional().isString().withMessage('Title must be a string'),
    body('includeDetails').optional().isBoolean().withMessage('Include details must be boolean'),
  ],
  handleValidationErrors,
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const {
        format,
        startDate,
        endDate,
        userId,
        entityType,
        action,
        limit,
        title,
        includeDetails
      } = req.body;

      const reportService = new AuditReportService();
      
      const filters = {
        startDate,
        endDate,
        userId,
        entityType,
        action,
        limit
      };

      const options = {
        format,
        title,
        includeDetails: includeDetails || false
      };

      const { filePath } = await reportService.generateReport(filters, options);

      // Send file for download
      const fileName = path.basename(filePath);
      res.download(filePath, fileName, (err) => {
        if (err) {
          console.error('❌ Error sending file:', err);
          res.status(500).json({
            success: false,
            message: 'Failed to send report file'
          });
        }
      });

    } catch (error) {
      console.error('❌ Error generating report:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate report',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// GET /audit/reports/user/:userId - Generate user activity report
router.get('/reports/user/:userId',
  authenticate,
  checkRole(['ADMIN']),
  [
    query('startDate').optional().isISO8601().withMessage('Invalid start date format'),
    query('endDate').optional().isISO8601().withMessage('Invalid end date format'),
    query('format').optional().isIn(['csv', 'json']).withMessage('Format must be csv or json'),
  ],
  handleValidationErrors,
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const userId = parseInt(req.params.userId);
      const { startDate, endDate, format = 'json' } = req.query as any;

      if (isNaN(userId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid user ID'
        });
        return;
      }

      const reportService = new AuditReportService();
      
      const { filePath, summary } = await reportService.generateUserActivityReport(
        userId,
        startDate,
        endDate,
        format
      );

      if (format === 'json') {
        // Return JSON response
        res.json({
          success: true,
          data: {
            summary,
            reportPath: filePath
          }
        });
      } else {
        // Send CSV file for download
        const fileName = path.basename(filePath);
        res.download(filePath, fileName, (err) => {
          if (err) {
            console.error('❌ Error sending file:', err);
            res.status(500).json({
              success: false,
              message: 'Failed to send report file'
            });
          }
        });
      }

    } catch (error) {
      console.error('❌ Error generating user activity report:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate user activity report',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// GET /audit/reports/summary - Get audit summary for dashboard
router.get('/reports/summary',
  authenticate,
  checkRole(['ADMIN']),
  [
    query('days').optional().isInt({ min: 1, max: 365 }).withMessage('Days must be between 1 and 365'),
  ],
  handleValidationErrors,
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - days);

      const statistics = await AuditRepository.getStatistics(startDate, endDate);
      
      res.json({
        success: true,
        data: {
          ...statistics,
          dateRange: {
            start: startDate.toISOString(),
            end: endDate.toISOString()
          }
        }
      });

    } catch (error) {
      console.error('❌ Error getting audit summary:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get audit summary',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// GET /audit/schedules - Get all scheduled cleanup jobs
router.get('/schedules',
  authenticate,
  checkRole(['ADMIN']),
  async (_req: express.Request, res: express.Response): Promise<void> => {
    try {
      const schedules = auditScheduleService.getAllSchedules();
      const statistics = auditScheduleService.getStatistics();
      const status = auditScheduleService.getStatus();

      res.json({
        success: true,
        data: {
          schedules,
          statistics,
          status
        }
      });

    } catch (error) {
      console.error('❌ Error getting schedules:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get scheduled jobs',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// POST /audit/schedules - Create a new scheduled cleanup job
router.post('/schedules',
  authenticate,
  checkRole(['ADMIN']),
  [
    body('id').isString().isLength({ min: 1, max: 50 }).withMessage('ID must be 1-50 characters'),
    body('name').isString().isLength({ min: 1, max: 100 }).withMessage('Name must be 1-100 characters'),
    body('cronExpression').isString().withMessage('Cron expression is required'),
    body('enabled').isBoolean().withMessage('Enabled must be boolean'),
    body('retentionDays').isInt({ min: 1, max: 3650 }).withMessage('Retention days must be between 1 and 3650'),
    body('enableArchiving').isBoolean().withMessage('Enable archiving must be boolean'),
    body('batchSize').isInt({ min: 100, max: 50000 }).withMessage('Batch size must be between 100 and 50000'),
  ],
  handleValidationErrors,
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const {
        id,
        name,
        cronExpression,
        enabled,
        retentionDays,
        enableArchiving,
        batchSize
      } = req.body;

      const schedule = await auditScheduleService.createSchedule({
        id,
        name,
        cronExpression,
        enabled,
        retentionDays,
        enableArchiving,
        batchSize
      });

      res.json({
        success: true,
        data: schedule,
        message: `Scheduled job '${name}' created successfully`
      });

    } catch (error) {
      console.error('❌ Error creating schedule:', error);
      res.status(400).json({
        success: false,
        message: 'Failed to create scheduled job',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// PUT /audit/schedules/:id - Update a scheduled cleanup job
router.put('/schedules/:id',
  authenticate,
  checkRole(['ADMIN']),
  [
    body('name').optional().isString().isLength({ min: 1, max: 100 }).withMessage('Name must be 1-100 characters'),
    body('cronExpression').optional().isString().withMessage('Cron expression must be string'),
    body('enabled').optional().isBoolean().withMessage('Enabled must be boolean'),
    body('retentionDays').optional().isInt({ min: 1, max: 3650 }).withMessage('Retention days must be between 1 and 3650'),
    body('enableArchiving').optional().isBoolean().withMessage('Enable archiving must be boolean'),
    body('batchSize').optional().isInt({ min: 100, max: 50000 }).withMessage('Batch size must be between 100 and 50000'),
  ],
  handleValidationErrors,
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const schedule = await auditScheduleService.updateSchedule(id, updates);

      res.json({
        success: true,
        data: schedule,
        message: `Scheduled job '${schedule.name}' updated successfully`
      });

    } catch (error) {
      console.error('❌ Error updating schedule:', error);
      res.status(400).json({
        success: false,
        message: 'Failed to update scheduled job',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// DELETE /audit/schedules/:id - Delete a scheduled cleanup job
router.delete('/schedules/:id',
  authenticate,
  checkRole(['ADMIN']),
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { id } = req.params;

      await auditScheduleService.deleteSchedule(id);

      res.json({
        success: true,
        message: `Scheduled job '${id}' deleted successfully`
      });

    } catch (error) {
      console.error('❌ Error deleting schedule:', error);
      res.status(400).json({
        success: false,
        message: 'Failed to delete scheduled job',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// POST /audit/schedules/:id/toggle - Enable/disable a scheduled job
router.post('/schedules/:id/toggle',
  authenticate,
  checkRole(['ADMIN']),
  [
    body('enabled').isBoolean().withMessage('Enabled must be boolean'),
  ],
  handleValidationErrors,
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { enabled } = req.body;

      const schedule = await auditScheduleService.toggleSchedule(id, enabled);

      res.json({
        success: true,
        data: schedule,
        message: `Scheduled job '${schedule.name}' ${enabled ? 'enabled' : 'disabled'} successfully`
      });

    } catch (error) {
      console.error('❌ Error toggling schedule:', error);
      res.status(400).json({
        success: false,
        message: 'Failed to toggle scheduled job',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// POST /audit/schedules/:id/run - Manually execute a scheduled job
router.post('/schedules/:id/run',
  authenticate,
  checkRole(['ADMIN']),
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { id } = req.params;

      const result = await auditScheduleService.runNow(id);

      res.json({
        success: true,
        data: result,
        message: `Scheduled job executed. ${result.success ? 
          `Deleted ${result.deletedCount} logs, archived ${result.archivedCount} logs` :
          `Failed: ${result.error}`
        }`
      });

    } catch (error) {
      console.error('❌ Error running schedule:', error);
      res.status(400).json({
        success: false,
        message: 'Failed to run scheduled job',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// ==========================================
// ANALYTICS ENDPOINTS
// ==========================================

// GET /audit/analytics/dashboard - Get comprehensive dashboard metrics
router.get('/analytics/dashboard',
  authenticate,
  checkRole(['ADMIN']),
  [
    query('start_date').optional().isISO8601().withMessage('Start date must be valid ISO date'),
    query('end_date').optional().isISO8601().withMessage('End date must be valid ISO date'),
    query('period').optional().isIn(['hour', 'day', 'week', 'month']).withMessage('Period must be hour, day, week, or month')
  ],
  handleValidationErrors,
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { start_date, end_date, period } = req.query;
      
      let timeRange;
      if (start_date && end_date) {
        timeRange = {
          start: new Date(start_date as string),
          end: new Date(end_date as string),
          period: (period as 'hour' | 'day' | 'week' | 'month') || 'day'
        };
      }

      const metrics = await AuditAnalyticsService.getDashboardMetrics(timeRange);

      res.json({
        success: true,
        data: metrics
      });
    } catch (error) {
      console.error('Error getting dashboard metrics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get dashboard metrics',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// GET /audit/analytics/realtime - Get real-time metrics
router.get('/analytics/realtime',
  authenticate,
  checkRole(['ADMIN']),
  async (_req: express.Request, res: express.Response): Promise<void> => {
    try {
      const now = new Date();
      const lastHour = new Date(now.getTime() - 60 * 60 * 1000);
      
      const timeRange = {
        start: lastHour,
        end: now,
        period: 'hour' as const
      };

      const metrics = await AuditAnalyticsService.getDashboardMetrics(timeRange);

      res.json({
        success: true,
        data: {
          timestamp: now.toISOString(),
          metrics: {
            recentLogs: metrics.overview.todayLogs,
            activeUsers: metrics.overview.activeUsers,
            alerts: metrics.alerts.filter(alert => !alert.resolved),
            systemHealth: metrics.systemHealth
          }
        }
      });
    } catch (error) {
      console.error('Error getting real-time metrics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get real-time metrics',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// GET /audit/analytics/trends/:type - Get specific trend data
router.get('/analytics/trends/:type',
  authenticate,
  checkRole(['ADMIN']),
  [
    query('start_date').optional().isISO8601().withMessage('Start date must be valid ISO date'),
    query('end_date').optional().isISO8601().withMessage('End date must be valid ISO date')
  ],
  handleValidationErrors,
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { type } = req.params;
      const { start_date, end_date } = req.query;

      if (!['daily', 'weekly', 'monthly'].includes(type)) {
        res.status(400).json({
          success: false,
          message: 'Invalid trend type. Must be daily, weekly, or monthly'
        });
        return;
      }

      let timeRange;
      if (start_date && end_date) {
        timeRange = {
          start: new Date(start_date as string),
          end: new Date(end_date as string),
          period: 'day' as const
        };
      }

      const metrics = await AuditAnalyticsService.getDashboardMetrics(timeRange);

      res.json({
        success: true,
        data: metrics.trends[type as keyof typeof metrics.trends]
      });
    } catch (error) {
      console.error('Error getting trend data:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get trend data',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// GET /audit/analytics/users - Get user activity analytics
router.get('/analytics/users',
  authenticate,
  checkRole(['ADMIN']),
  [
    query('start_date').optional().isISO8601().withMessage('Start date must be valid ISO date'),
    query('end_date').optional().isISO8601().withMessage('End date must be valid ISO date'),
    query('type').optional().isIn(['active', 'new', 'inactive']).withMessage('Type must be active, new, or inactive')
  ],
  handleValidationErrors,
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { start_date, end_date, type } = req.query;
      
      let timeRange;
      if (start_date && end_date) {
        timeRange = {
          start: new Date(start_date as string),
          end: new Date(end_date as string),
          period: 'day' as const
        };
      }

      const metrics = await AuditAnalyticsService.getDashboardMetrics(timeRange);

      let userData;
      switch (type) {
        case 'active':
          userData = metrics.userActivity.mostActive;
          break;
        case 'new':
          userData = metrics.userActivity.newUsers;
          break;
        case 'inactive':
          userData = metrics.userActivity.inactiveUsers;
          break;
        default:
          userData = metrics.userActivity;
      }

      res.json({
        success: true,
        data: userData
      });
    } catch (error) {
      console.error('Error getting user analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get user analytics',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// GET /audit/analytics/health - Get system health status
router.get('/analytics/health',
  authenticate,
  checkRole(['ADMIN']),
  async (_req: express.Request, res: express.Response): Promise<void> => {
    try {
      const metrics = await AuditAnalyticsService.getDashboardMetrics();

      res.json({
        success: true,
        data: {
          systemHealth: metrics.systemHealth,
          alerts: metrics.alerts,
          overview: {
            totalLogs: metrics.overview.totalLogs,
            retentionHealth: metrics.overview.retentionHealth,
            activeUsers: metrics.overview.activeUsers
          }
        }
      });
    } catch (error) {
      console.error('Error getting system health:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get system health',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

export { router as auditRouter };
