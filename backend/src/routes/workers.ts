import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { WorkerRepository } from '../repositories/WorkerRepository';
import { authenticate } from '../middleware/auth';
import { checkRole } from '../middleware/rbac';

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

// Get all workers with optional filtering
router.get('/', 
  authenticate,
  checkRole(['ADMIN', 'SITE_INCHARGE', 'FOREMAN']),
  [
    query('site_id').optional().trim().isLength({ min: 1 }).withMessage('Invalid site ID format'),
    query('status').optional().isIn(['active', 'inactive']).withMessage('Status must be active or inactive'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
  ],
  handleValidationErrors,
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { site_id, status, page = 1, limit = 20 } = req.query as any;
      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

      const workers = await WorkerRepository.findAll({
        site_id,
        status,
        offset: parseInt(offset.toString()),
        limit: parseInt(limit as string)
      });

      const totalCount = await WorkerRepository.getTotalCount({
        site_id,
        status
      });

      res.json({
        success: true,
        data: workers,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: totalCount,
          totalPages: Math.ceil(totalCount / parseInt(limit as string))
        }
      });
    } catch (error) {
      console.error('Error fetching workers:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

// Get worker by ID
router.get('/:id',
  authenticate,
  checkRole(['ADMIN', 'SITE_INCHARGE', 'FOREMAN']),
  [
    param('id').trim().isLength({ min: 1 }).withMessage('Worker ID is required')
  ],
  handleValidationErrors,
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { id } = req.params;
      const worker = await WorkerRepository.findByIdWithSite(id);

      if (!worker) {
        res.status(404).json({
          success: false,
          message: 'Worker not found'
        });
        return;
      }

      res.json({
        success: true,
        data: worker
      });
    } catch (error) {
      console.error('Error fetching worker:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

// Create new worker
router.post('/',
  authenticate,
  checkRole(['ADMIN', 'SITE_INCHARGE']),
  [
    body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
    body('father_name').trim().isLength({ min: 2, max: 100 }).withMessage('Father name must be between 2 and 100 characters'),
    body('phone_number').optional().trim().matches(/^\+?[\d\s\-\(\)]+$/).withMessage('Invalid phone number format'),
    body('site_id').trim().isLength({ min: 1 }).withMessage('Site ID is required'),
    body('worker_id').optional().trim().isLength({ min: 1, max: 50 }).withMessage('Worker ID must be between 1 and 50 characters')
  ],
  handleValidationErrors,
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { name, father_name, phone_number, site_id } = req.body;

      const newWorker = await WorkerRepository.create({
        name,
        father_name,
        phone_number,
        site_id
      });

      res.status(201).json({
        success: true,
        data: newWorker,
        message: 'Worker created successfully'
      });
    } catch (error: any) {
      console.error('Error creating worker:', error);
      
      if (error.message?.includes('UNIQUE constraint failed')) {
        res.status(409).json({
          success: false,
          message: 'Worker already exists with this phone number'
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

// Update worker
router.put('/:id',
  authenticate,
  checkRole(['ADMIN', 'SITE_INCHARGE']),
  [
    param('id').trim().isLength({ min: 1 }).withMessage('Worker ID is required'),
    body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
    body('father_name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Father name must be between 2 and 100 characters'),
    body('phone_number').optional().trim().matches(/^\+?[\d\s\-\(\)]+$/).withMessage('Invalid phone number format'),
    body('site_id').optional().trim().isLength({ min: 1 }).withMessage('Invalid site ID format'),
    body('is_active').optional().isBoolean().withMessage('is_active must be a boolean')
  ],
  handleValidationErrors,
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Check if worker exists
      const existingWorker = await WorkerRepository.findById(id);
      if (!existingWorker) {
        res.status(404).json({
          success: false,
          message: 'Worker not found'
        });
        return;
      }

      const updatedWorker = await WorkerRepository.update(id, updateData);

      res.json({
        success: true,
        data: updatedWorker,
        message: 'Worker updated successfully'
      });
    } catch (error: any) {
      console.error('Error updating worker:', error);
      
      if (error.message?.includes('UNIQUE constraint failed')) {
        res.status(409).json({
          success: false,
          message: 'Phone number already exists'
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

// Transfer worker to different site
router.post('/:id/transfer',
  authenticate,
  checkRole(['ADMIN', 'SITE_INCHARGE']),
  [
    param('id').trim().isLength({ min: 1 }).withMessage('Worker ID is required'),
    body('new_site_id').trim().isLength({ min: 1 }).withMessage('Site ID is required')
  ],
  handleValidationErrors,
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { new_site_id } = req.body;

      // Check if worker exists
      const existingWorker = await WorkerRepository.findById(id);
      if (!existingWorker) {
        res.status(404).json({
          success: false,
          message: 'Worker not found'
        });
        return;
      }

      const transferredWorker = await WorkerRepository.transferToSite(id, new_site_id);

      res.json({
        success: true,
        data: transferredWorker,
        message: 'Worker transferred successfully'
      });
    } catch (error) {
      console.error('Error transferring worker:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

// Deactivate worker (soft delete)
router.delete('/:id',
  authenticate,
  checkRole(['ADMIN', 'SITE_INCHARGE']),
  [
    param('id').trim().isLength({ min: 1 }).withMessage('Worker ID is required')
  ],
  handleValidationErrors,
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { id } = req.params;

      // Check if worker exists
      const existingWorker = await WorkerRepository.findById(id);
      if (!existingWorker) {
        res.status(404).json({
          success: false,
          message: 'Worker not found'
        });
        return;
      }

      const deactivatedWorker = await WorkerRepository.deactivate(id);

      res.json({
        success: true,
        data: deactivatedWorker,
        message: 'Worker deactivated successfully'
      });
    } catch (error) {
      console.error('Error deactivating worker:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

// Get worker attendance statistics
router.get('/:id/attendance-stats',
  authenticate,
  checkRole(['ADMIN', 'SITE_INCHARGE', 'FOREMAN']),
  [
    param('id').trim().isLength({ min: 1 }).withMessage('Worker ID is required'),
    query('start_date').optional().isISO8601().withMessage('Invalid start date format'),
    query('end_date').optional().isISO8601().withMessage('Invalid end date format')
  ],
  handleValidationErrors,
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { start_date, end_date } = req.query as any;

      // Check if worker exists
      const worker = await WorkerRepository.findById(id);
      if (!worker) {
        res.status(404).json({
          success: false,
          message: 'Worker not found'
        });
        return;
      }

      const stats = await WorkerRepository.getAttendanceStatistics(id, start_date, end_date);

      res.json({
        success: true,
        data: stats
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

export default router;
