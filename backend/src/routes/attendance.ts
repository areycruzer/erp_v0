import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { AttendanceRepository } from '../repositories/AttendanceRepository';
import { NewAttendanceRepository } from '../repositories/NewAttendanceRepository';
import { WorkerRepository } from '../repositories/WorkerRepository';
import { SiteRepository } from '../repositories/SiteRepository';
import { authenticate } from '../middleware/auth';
import { checkRole } from '../middleware/rbac';
import { AuditService } from '../services/AuditService';
import { NotificationService } from '../services/NotificationService';

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

// Get all attendance records with optional filtering
router.get('/', 
  authenticate,
  checkRole(['ADMIN', 'SITE_INCHARGE', 'FOREMAN']),
  [
    query('site_id').optional().trim().isLength({ min: 1 }).withMessage('Invalid site ID format'),
    query('worker_id').optional().trim().isLength({ min: 1 }).withMessage('Invalid worker ID format'),
    query('date_from').optional().isISO8601().withMessage('Invalid start date format'),
    query('date_to').optional().isISO8601().withMessage('Invalid end date format'),
    query('status').optional().isIn(['PRESENT', 'ABSENT']).withMessage('Status must be PRESENT or ABSENT'),
    query('verified').optional().isBoolean().withMessage('Verified must be a boolean'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
  ],
  handleValidationErrors,
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { 
        site_id, 
        worker_id, 
        date_from, 
        date_to, 
        status, 
        verified, 
        page = 1, 
        limit = 20 
      } = req.query as any;
      
      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

      const verifiedFilter = verified !== undefined ? verified === 'true' : undefined;

      // Build filters object, only including defined values
      const filters: any = {
        site_id,
        worker_id,
        date_from,
        date_to,
        status,
        offset: parseInt(offset.toString()),
        limit: parseInt(limit as string)
      };
      
      if (verifiedFilter !== undefined) {
        filters.verified = verifiedFilter;
      }

      const records = await AttendanceRepository.findAllWithDetails(filters);

      // Build filters for count (without pagination)
      const countFilters: any = {
        site_id,
        worker_id,
        date_from,
        date_to,
        status
      };
      
      if (verifiedFilter !== undefined) {
        countFilters.verified = verifiedFilter;
      }

      const totalCount = await AttendanceRepository.getTotalCount(countFilters);

      res.json({
        success: true,
        data: records,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: totalCount,
          totalPages: Math.ceil(totalCount / parseInt(limit as string))
        }
      });
    } catch (error) {
      console.error('Error fetching attendance records:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

// Get attendance record by ID
router.get('/:id',
  authenticate,
  checkRole(['ADMIN', 'SITE_INCHARGE', 'FOREMAN']),
  [
    param('id').trim().isLength({ min: 1 }).withMessage('Attendance record ID is required')
  ],
  handleValidationErrors,
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { id } = req.params;
      const record = await AttendanceRepository.findById(id);

      if (!record) {
        res.status(404).json({
          success: false,
          message: 'Attendance record not found'
        });
        return;
      }

      res.json({
        success: true,
        data: record
      });
    } catch (error) {
      console.error('Error fetching attendance record:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

// Create new attendance record (check-in/check-out)
router.post('/',
  authenticate,
  checkRole(['ADMIN', 'SITE_INCHARGE', 'FOREMAN']),
  [
    body('site_id').trim().isLength({ min: 1 }).withMessage('Site ID is required'),
    body('worker_id').trim().isLength({ min: 1 }).withMessage('Worker ID is required'),
    body('date').isISO8601().withMessage('Valid date is required (YYYY-MM-DD)'),
    body('status').isIn(['PRESENT', 'ABSENT']).withMessage('Status must be PRESENT or ABSENT'),
    body('x_value').isFloat().withMessage('X value must be a number'),
    body('y_value').isFloat().withMessage('Y value must be a number'),
    body('calculated_hours').optional().isFloat({ min: 0, max: 24 }).withMessage('Hours must be between 0 and 24')
  ],
  handleValidationErrors,
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { site_id, worker_id, date, status, x_value, y_value, calculated_hours } = req.body;

      // Verify worker exists and is active
      const worker = await WorkerRepository.findById(worker_id);
      if (!worker) {
        res.status(404).json({
          success: false,
          message: 'Worker not found'
        });
        return;
      }

      if (!worker.is_active) {
        res.status(400).json({
          success: false,
          message: 'Cannot record attendance for inactive worker'
        });
        return;
      }

      // Verify site exists
      const site = await SiteRepository.findById(site_id);
      if (!site) {
        res.status(404).json({
          success: false,
          message: 'Site not found'
        });
        return;
      }

      // Check if attendance already exists for this worker and date
      const existingRecord = await AttendanceRepository.findByWorkerAndDate(worker_id, date);
      if (existingRecord) {
        res.status(409).json({
          success: false,
          message: 'Attendance record already exists for this worker and date'
        });
        return;
      }

      // Create attendance record
      const newRecord = await AttendanceRepository.create({
        site_id,
        worker_id,
        date,
        status,
        x_value: parseFloat(x_value),
        y_value: parseFloat(y_value),
        calculated_hours: calculated_hours ? parseFloat(calculated_hours) : (status === 'PRESENT' ? site.full_day_hours : 0),
        submitted_by: req.user!.userId
      });

      res.status(201).json({
        success: true,
        data: newRecord,
        message: 'Attendance recorded successfully'
      });
    } catch (error: any) {
      console.error('Error creating attendance record:', error);
      
      if (error.message?.includes('UNIQUE constraint failed')) {
        res.status(409).json({
          success: false,
          message: 'Attendance record already exists for this worker and date'
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

// Update attendance record
router.put('/:id',
  authenticate,
  checkRole(['ADMIN', 'SITE_INCHARGE']),
  [
    param('id').trim().isLength({ min: 1 }).withMessage('Attendance record ID is required'),
    body('status').optional().isIn(['PRESENT', 'ABSENT']).withMessage('Status must be PRESENT or ABSENT'),
    body('x_value').optional().isFloat().withMessage('X value must be a number'),
    body('y_value').optional().isFloat().withMessage('Y value must be a number'),
    body('calculated_hours').optional().isFloat({ min: 0, max: 24 }).withMessage('Hours must be between 0 and 24')
  ],
  handleValidationErrors,
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Check if record exists
      const existingRecord = await AttendanceRepository.findById(id);
      if (!existingRecord) {
        res.status(404).json({
          success: false,
          message: 'Attendance record not found'
        });
        return;
      }

      // Store original values before update if they're being changed
      if (updateData.status && updateData.status !== existingRecord.status) {
        updateData.original_status = existingRecord.status;
      }
      if (updateData.x_value && updateData.x_value !== existingRecord.x_value) {
        updateData.original_x_value = existingRecord.x_value;
      }
      if (updateData.y_value && updateData.y_value !== existingRecord.y_value) {
        updateData.original_y_value = existingRecord.y_value;
      }

      const updatedRecord = await AttendanceRepository.update(id, updateData);

      res.json({
        success: true,
        data: updatedRecord,
        message: 'Attendance record updated successfully'
      });
    } catch (error) {
      console.error('Error updating attendance record:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

// Verify attendance record (for supervisors)
router.post('/:id/verify',
  authenticate,
  checkRole(['ADMIN', 'SITE_INCHARGE']),
  [
    param('id').trim().isLength({ min: 1 }).withMessage('Attendance record ID is required')
  ],
  handleValidationErrors,
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { id } = req.params;

      // Check if record exists
      const existingRecord = await AttendanceRepository.findById(id);
      if (!existingRecord) {
        res.status(404).json({
          success: false,
          message: 'Attendance record not found'
        });
        return;
      }

      if (existingRecord.verified) {
        res.status(400).json({
          success: false,
          message: 'Attendance record is already verified'
        });
        return;
      }

      const verifiedRecord = await AttendanceRepository.verifyAttendance(id, req.user!.userId);

      res.json({
        success: true,
        data: verifiedRecord,
        message: 'Attendance record verified successfully'
      });
    } catch (error) {
      console.error('Error verifying attendance record:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

// Bulk verify attendance records
router.post('/bulk-verify',
  authenticate,
  checkRole(['ADMIN', 'SITE_INCHARGE']),
  [
    body('record_ids').isArray({ min: 1 }).withMessage('Record IDs array is required'),
    body('record_ids.*').trim().isLength({ min: 1 }).withMessage('Each record ID must be valid')
  ],
  handleValidationErrors,
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { record_ids } = req.body;

      const verifiedCount = await AttendanceRepository.bulkVerifyAttendance(record_ids, req.user!.userId);

      res.json({
        success: true,
        data: { verifiedCount },
        message: `${verifiedCount} attendance records verified successfully`
      });
    } catch (error) {
      console.error('Error bulk verifying attendance records:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

// Get worker attendance statistics
router.get('/stats/worker/:workerId',
  authenticate,
  checkRole(['ADMIN', 'SITE_INCHARGE', 'FOREMAN']),
  [
    param('workerId').trim().isLength({ min: 1 }).withMessage('Worker ID is required'),
    query('date_from').optional().isISO8601().withMessage('Invalid start date format'),
    query('date_to').optional().isISO8601().withMessage('Invalid end date format')
  ],
  handleValidationErrors,
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { workerId } = req.params;
      const { date_from, date_to } = req.query as any;

      // Check if worker exists
      const worker = await WorkerRepository.findById(workerId);
      if (!worker) {
        res.status(404).json({
          success: false,
          message: 'Worker not found'
        });
        return;
      }

      const stats = await AttendanceRepository.getWorkerAttendanceStats(workerId, date_from, date_to);

      res.json({
        success: true,
        data: {
          worker: {
            id: worker.id,
            name: worker.name,
            father_name: worker.father_name
          },
          statistics: stats,
          dateRange: {
            from: date_from || 'All time',
            to: date_to || 'All time'
          }
        }
      });
    } catch (error) {
      console.error('Error fetching worker attendance stats:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

// Get site attendance statistics
router.get('/stats/site/:siteId',
  authenticate,
  checkRole(['ADMIN', 'SITE_INCHARGE', 'FOREMAN']),
  [
    param('siteId').trim().isLength({ min: 1 }).withMessage('Site ID is required'),
    query('date').optional().isISO8601().withMessage('Invalid date format')
  ],
  handleValidationErrors,
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { siteId } = req.params;
      const { date } = req.query as any;

      // Check if site exists
      const site = await SiteRepository.findById(siteId);
      if (!site) {
        res.status(404).json({
          success: false,
          message: 'Site not found'
        });
        return;
      }

      const stats = await AttendanceRepository.getSiteAttendanceStats(siteId, date);

      res.json({
        success: true,
        data: {
          site: {
            id: site.id,
            name: site.name,
            location: site.location
          },
          statistics: stats,
          date: date || new Date().toISOString().split('T')[0]
        }
      });
    } catch (error) {
      console.error('Error fetching site attendance stats:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

// Delete attendance record
router.delete('/:id',
  authenticate,
  checkRole(['ADMIN']),
  [
    param('id').trim().isLength({ min: 1 }).withMessage('Attendance record ID is required')
  ],
  handleValidationErrors,
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { id } = req.params;

      // Check if record exists
      const existingRecord = await AttendanceRepository.findById(id);
      if (!existingRecord) {
        res.status(404).json({
          success: false,
          message: 'Attendance record not found'
        });
        return;
      }

      const deleted = await AttendanceRepository.delete(id);

      if (deleted) {
        res.json({
          success: true,
          message: 'Attendance record deleted successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to delete attendance record'
        });
      }
    } catch (error) {
      console.error('Error deleting attendance record:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

// ========== NEW ATTENDANCE SYSTEM (P/A/HD) ==========

// Get all new attendance records with optional filtering
router.get('/v2', 
  authenticate,
  checkRole(['ADMIN', 'SITE_INCHARGE', 'FOREMAN']),
  [
    query('site_id').optional().trim().isLength({ min: 1 }).withMessage('Invalid site ID format'),
    query('worker_id').optional().trim().isLength({ min: 1 }).withMessage('Invalid worker ID format'),
    query('date').optional().isISO8601().withMessage('Invalid date format'),
    query('status').optional().isIn(['PENDING', 'APPROVED', 'REJECTED']).withMessage('Status must be PENDING, APPROVED, or REJECTED'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be a non-negative integer')
  ],
  handleValidationErrors,
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { site_id, worker_id, date, status, limit = 50, offset = 0 } = req.query as any;
      
      const filters: any = {
        site_id,
        worker_id,
        date,
        status,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      };

      const result = await NewAttendanceRepository.findAll(filters);

      res.json({
        success: true,
        attendance: result.attendance,
        total: result.total
      });
    } catch (error) {
      console.error('Error fetching new attendance records:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

// Get new attendance record by ID
router.get('/v2/:id',
  authenticate,
  checkRole(['ADMIN', 'SITE_INCHARGE', 'FOREMAN']),
  [
    param('id').trim().isLength({ min: 1 }).withMessage('Attendance record ID is required')
  ],
  handleValidationErrors,
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { id } = req.params;
      const record = await NewAttendanceRepository.findById(id);

      if (!record) {
        res.status(404).json({
          success: false,
          message: 'Attendance record not found'
        });
        return;
      }

      res.json({
        success: true,
        attendance: record
      });
    } catch (error) {
      console.error('Error fetching new attendance record:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

// Create new attendance record (P/A/HD system)
router.post('/v2',
  authenticate,
  checkRole(['ADMIN', 'FOREMAN']),
  [
    body('worker_id').trim().isLength({ min: 1 }).withMessage('Worker ID is required'),
    body('site_id').trim().isLength({ min: 1 }).withMessage('Site ID is required'),
    body('date').isISO8601().withMessage('Valid date is required (YYYY-MM-DD)'),
    body('P').isFloat({ min: 0 }).withMessage('P value must be a non-negative number'),
    body('A').isFloat({ min: 0 }).withMessage('A value must be a non-negative number'),
    body('HD').isFloat({ min: 0 }).withMessage('HD value must be a non-negative number'),
    body('interpretation_mode').isIn(['TOTAL_COUNT', 'P_ONLY']).withMessage('Interpretation mode must be TOTAL_COUNT or P_ONLY')
  ],
  handleValidationErrors,
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { worker_id, site_id, date, P, A, HD, interpretation_mode } = req.body;

      // Verify worker exists and is active
      const worker = await WorkerRepository.findById(worker_id);
      if (!worker) {
        res.status(404).json({
          success: false,
          message: 'Worker not found'
        });
        return;
      }

      if (!worker.is_active) {
        res.status(400).json({
          success: false,
          message: 'Cannot record attendance for inactive worker'
        });
        return;
      }

      // Verify site exists
      const site = await SiteRepository.findById(site_id);
      if (!site) {
        res.status(404).json({
          success: false,
          message: 'Site not found'
        });
        return;
      }

      // Check if attendance already exists for this worker and date
      const existingRecord = await NewAttendanceRepository.findByWorkerAndDate(worker_id, date);
      if (existingRecord) {
        res.status(409).json({
          success: false,
          message: 'Attendance record already exists for this worker and date'
        });
        return;
      }

      // Create attendance record
      const auditContext = AuditService.extractContext(req);
      const newRecord = await NewAttendanceRepository.create({
        worker_id,
        site_id,
        date,
        P: parseFloat(P),
        A: parseFloat(A),
        HD: parseFloat(HD),
        interpretation_mode,
        submitted_by: req.user!.userId,
        status: 'PENDING'
      }, auditContext);

      // Send notification to site incharge and admins about new attendance submission
      try {
        await NotificationService.notifyAttendanceSubmitted(
          parseInt(req.user!.userId.toString()),
          site.name,
          date
        );
      } catch (notificationError) {
        console.warn('Failed to send attendance submission notification:', notificationError);
        // Don't fail the request if notification fails
      }

      res.status(201).json({
        success: true,
        attendance: newRecord,
        message: 'Attendance recorded successfully'
      });
    } catch (error: any) {
      console.error('Error creating new attendance record:', error);
      
      if (error.message?.includes('UNIQUE constraint failed')) {
        res.status(409).json({
          success: false,
          message: 'Attendance record already exists for this worker and date'
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

// Update new attendance record
router.put('/v2/:id',
  authenticate,
  checkRole(['ADMIN', 'SITE_INCHARGE']),
  [
    param('id').trim().isLength({ min: 1 }).withMessage('Attendance record ID is required'),
    body('P').optional().isFloat({ min: 0 }).withMessage('P value must be a non-negative number'),
    body('A').optional().isFloat({ min: 0 }).withMessage('A value must be a non-negative number'),
    body('HD').optional().isFloat({ min: 0 }).withMessage('HD value must be a non-negative number'),
    body('interpretation_mode').optional().isIn(['TOTAL_COUNT', 'P_ONLY']).withMessage('Interpretation mode must be TOTAL_COUNT or P_ONLY')
  ],
  handleValidationErrors,
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Check if record exists
      const existingRecord = await NewAttendanceRepository.findById(id);
      if (!existingRecord) {
        res.status(404).json({
          success: false,
          message: 'Attendance record not found'
        });
        return;
      }

      const updatedRecord = await NewAttendanceRepository.update(id, updateData, AuditService.extractContext(req));

      res.json({
        success: true,
        attendance: updatedRecord,
        message: 'Attendance record updated successfully'
      });
    } catch (error) {
      console.error('Error updating new attendance record:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

// Approve attendance record
router.put('/v2/:id/approve',
  authenticate,
  checkRole(['ADMIN', 'SITE_INCHARGE']),
  [
    param('id').trim().isLength({ min: 1 }).withMessage('Attendance record ID is required')
  ],
  handleValidationErrors,
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { id } = req.params;

      // Check if record exists
      const existingRecord = await NewAttendanceRepository.findById(id);
      if (!existingRecord) {
        res.status(404).json({
          success: false,
          message: 'Attendance record not found'
        });
        return;
      }

      if (existingRecord.status !== 'PENDING') {
        res.status(400).json({
          success: false,
          message: 'Only pending attendance records can be approved'
        });
        return;
      }

      const approvedRecord = await NewAttendanceRepository.approve(id, req.user!.userId, AuditService.extractContext(req));

      // Send notification to the submitter about approval
      try {
        const site = await SiteRepository.findById(existingRecord.site_id);
        const totalHours = existingRecord.P + (existingRecord.HD / 2); // Calculate total hours
        
        await NotificationService.notifyAttendanceApproved(
          parseInt(existingRecord.submitted_by.toString()),
          site?.name || 'Unknown Site',
          existingRecord.date,
          totalHours
        );
      } catch (notificationError) {
        console.warn('Failed to send attendance approval notification:', notificationError);
        // Don't fail the request if notification fails
      }

      res.json({
        success: true,
        attendance: approvedRecord,
        message: 'Attendance record approved successfully'
      });
    } catch (error) {
      console.error('Error approving attendance record:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

// Reject attendance record
router.put('/v2/:id/reject',
  authenticate,
  checkRole(['ADMIN', 'SITE_INCHARGE']),
  [
    param('id').trim().isLength({ min: 1 }).withMessage('Attendance record ID is required')
  ],
  handleValidationErrors,
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { id } = req.params;

      // Check if record exists
      const existingRecord = await NewAttendanceRepository.findById(id);
      if (!existingRecord) {
        res.status(404).json({
          success: false,
          message: 'Attendance record not found'
        });
        return;
      }

      if (existingRecord.status !== 'PENDING') {
        res.status(400).json({
          success: false,
          message: 'Only pending attendance records can be rejected'
        });
        return;
      }

      const rejectedRecord = await NewAttendanceRepository.reject(id, req.user!.userId, AuditService.extractContext(req));

      // Send notification to the submitter about rejection
      try {
        const site = await SiteRepository.findById(existingRecord.site_id);
        
        await NotificationService.notifyAttendanceRejected(
          parseInt(existingRecord.submitted_by.toString()),
          site?.name || 'Unknown Site',
          existingRecord.date,
          'Attendance record was rejected by supervisor'
        );
      } catch (notificationError) {
        console.warn('Failed to send attendance rejection notification:', notificationError);
        // Don't fail the request if notification fails
      }

      res.json({
        success: true,
        attendance: rejectedRecord,
        message: 'Attendance record rejected successfully'
      });
    } catch (error) {
      console.error('Error rejecting attendance record:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

// Get pending approvals for site incharge
router.get('/v2/pending-approvals/:siteInchargeId?',
  authenticate,
  checkRole(['ADMIN', 'SITE_INCHARGE']),
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { siteInchargeId } = req.params;
      
      // If no siteInchargeId provided and user is not admin, use current user's ID
      const userId = siteInchargeId || (req.user!.role !== 'ADMIN' ? req.user!.userId : undefined);
      
      const pendingRecords = await NewAttendanceRepository.getPendingApprovals(userId);

      res.json({
        success: true,
        attendance: pendingRecords,
        total: pendingRecords.length
      });
    } catch (error) {
      console.error('Error fetching pending approvals:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

export default router;
