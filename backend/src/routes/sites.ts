import { Router, Request, Response } from 'express';
import { SiteRepository, UserRepository } from '../repositories';
import { authenticate, adminOnly, siteInchargeLevel } from '../middleware/auth';
import { body, param, query, validationResult } from 'express-validator';

const router = Router();

// Validation rules
const createSiteValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Site name must be between 2 and 100 characters'),
  body('location')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Location must not exceed 200 characters'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes must not exceed 500 characters'),
  body('full_day_hours')
    .optional()
    .isFloat({ min: 1, max: 24 })
    .withMessage('Full day hours must be between 1 and 24'),
  body('interpretation_mode')
    .optional()
    .isIn(['HOURS', 'HALF_DAYS'])
    .withMessage('Interpretation mode must be HOURS or HALF_DAYS'),
  body('checkpoint_time')
    .optional()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/)
    .withMessage('Checkpoint time must be in HH:MM:SS format'),
  body('timezone')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Timezone must not exceed 50 characters'),
];

const updateSiteValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Site name must be between 2 and 100 characters'),
  body('location')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Location must not exceed 200 characters'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes must not exceed 500 characters'),
  body('full_day_hours')
    .optional()
    .isFloat({ min: 1, max: 24 })
    .withMessage('Full day hours must be between 1 and 24'),
  body('interpretation_mode')
    .optional()
    .isIn(['HOURS', 'HALF_DAYS'])
    .withMessage('Interpretation mode must be HOURS or HALF_DAYS'),
  body('checkpoint_time')
    .optional()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/)
    .withMessage('Checkpoint time must be in HH:MM:SS format'),
  body('timezone')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Timezone must not exceed 50 characters'),
];

const siteIdValidation = [
  param('id')
    .notEmpty()
    .withMessage('Site ID is required')
];

// Helper function to handle validation errors
const handleValidationErrors = (req: Request, res: Response): boolean => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
    return true;
  }
  return false;
};

// Helper function to check if user can access site
const canAccessSite = async (req: Request, res: Response, next: any): Promise<void> => {
  try {
    const user = req.user as any;
    const siteId = req.params.id;

    // Admins can access all sites
    if (user.role === 'ADMIN') {
      next();
      return;
    }

    // Check if user is assigned to this site
    const userWithSites = await UserRepository.findByIdWithSites(user.userId);
    if (!userWithSites || !userWithSites.assigned_sites.some(site => site.id === siteId)) {
      res.status(403).json({
        success: false,
        message: 'Access denied: You are not assigned to this site'
      });
      return;
    }

    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to verify site access'
    });
  }
};

// GET /api/sites - Get all sites
router.get('/', 
  authenticate,
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('search')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Search term must not exceed 100 characters'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (handleValidationErrors(req, res)) return;

      const user = req.user as any;
      const { page = 1, limit = 10, search } = req.query;
      
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      let sites;

      // Admins can see all sites, others only their assigned sites
      if (user.role === 'ADMIN') {
        sites = await SiteRepository.findAll();
      } else {
        const userWithSites = await UserRepository.findByIdWithSites(user.userId);
        sites = userWithSites?.assigned_sites || [];
      }

      // Apply search filter if provided
      if (search) {
        const searchTerm = (search as string).toLowerCase();
        sites = sites.filter(site => 
          site.name.toLowerCase().includes(searchTerm) ||
          (site.location && site.location.toLowerCase().includes(searchTerm))
        );
      }

      // Apply pagination
      const paginatedSites = sites.slice(offset, offset + limitNum);
      const total = sites.length;

      res.json({
        success: true,
        message: 'Sites retrieved successfully',
        data: {
          sites: paginatedSites,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum)
          }
        }
      });
    } catch (error) {
      console.error('Get sites error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve sites'
      });
    }
  }
);

// GET /api/sites/:id - Get site by ID
router.get('/:id',
  authenticate,
  siteIdValidation,
  canAccessSite,
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (handleValidationErrors(req, res)) return;

      const siteId = req.params.id;
      const site = await SiteRepository.findById(siteId);

      if (!site) {
        res.status(404).json({
          success: false,
          message: 'Site not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Site retrieved successfully',
        data: { site }
      });
    } catch (error) {
      console.error('Get site error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve site'
      });
    }
  }
);

// GET /api/sites/:id/users - Get users assigned to site
router.get('/:id/users',
  authenticate,
  siteIdValidation,
  canAccessSite,
  [
    query('role')
      .optional()
      .isIn(['FOREMAN', 'SITE_INCHARGE', 'ADMIN'])
      .withMessage('Invalid role filter'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (handleValidationErrors(req, res)) return;

      const siteId = req.params.id;
      const { role } = req.query;

      const users = await UserRepository.findBySiteId(siteId, role as any);

      // Remove password hashes from response
      const safeUsers = users.map(user => {
        const { password_hash, ...safeUser } = user;
        return safeUser;
      });

      res.json({
        success: true,
        message: 'Site users retrieved successfully',
        data: { users: safeUsers }
      });
    } catch (error) {
      console.error('Get site users error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve site users'
      });
    }
  }
);

// GET /api/sites/:id/workers - Get workers at site
router.get('/:id/workers',
  authenticate,
  siteIdValidation,
  canAccessSite,
  [
    query('is_active')
      .optional()
      .isBoolean()
      .withMessage('is_active must be a boolean'),
    query('search')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Search term must not exceed 100 characters'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (handleValidationErrors(req, res)) return;

      const siteId = req.params.id;
      const { is_active, search } = req.query;

      // Get workers for this site using WorkerRepository
      // Note: This will be implemented when we create the WorkerRepository
      const workers = await SiteRepository.getWorkers(
        siteId, 
        is_active === 'true' ? true : is_active === 'false' ? false : undefined,
        search as string
      );

      res.json({
        success: true,
        message: 'Site workers retrieved successfully',
        data: { workers }
      });
    } catch (error) {
      console.error('Get site workers error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve site workers'
      });
    }
  }
);

// POST /api/sites - Create new site
router.post('/',
  authenticate,
  adminOnly,
  createSiteValidation,
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (handleValidationErrors(req, res)) return;

      const siteData = req.body;

      // Set defaults for optional fields
      const newSite = await SiteRepository.create({
        name: siteData.name,
        location: siteData.location || '',
        notes: siteData.notes || '',
        full_day_hours: siteData.full_day_hours || 8,
        interpretation_mode: siteData.interpretation_mode || 'HOURS',
        checkpoint_time: siteData.checkpoint_time || '12:00:00',
        timezone: siteData.timezone || 'UTC'
      });

      res.status(201).json({
        success: true,
        message: 'Site created successfully',
        data: { site: newSite }
      });
    } catch (error) {
      console.error('Create site error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create site'
      });
    }
  }
);

// PUT /api/sites/:id - Update site
router.put('/:id',
  authenticate,
  siteIdValidation,
  updateSiteValidation,
  siteInchargeLevel,
  canAccessSite,
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (handleValidationErrors(req, res)) return;

      const siteId = req.params.id;
      const updateData = req.body;

      // Check if site exists
      const existingSite = await SiteRepository.findById(siteId);
      if (!existingSite) {
        res.status(404).json({
          success: false,
          message: 'Site not found'
        });
        return;
      }

      // Update site
      const updatedSite = await SiteRepository.update(siteId, updateData);

      if (!updatedSite) {
        res.status(500).json({
          success: false,
          message: 'Failed to update site'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Site updated successfully',
        data: { site: updatedSite }
      });
    } catch (error) {
      console.error('Update site error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update site'
      });
    }
  }
);

// POST /api/sites/:id/assign-user - Assign user to site
router.post('/:id/assign-user',
  authenticate,
  adminOnly,
  [
    ...siteIdValidation,
    body('userId')
      .notEmpty()
      .withMessage('User ID is required'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (handleValidationErrors(req, res)) return;

      const siteId = req.params.id;
      const { userId } = req.body;

      // Check if site exists
      const site = await SiteRepository.findById(siteId);
      if (!site) {
        res.status(404).json({
          success: false,
          message: 'Site not found'
        });
        return;
      }

      // Check if user exists
      const user = await UserRepository.findById(userId);
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      // Assign user to site
      await UserRepository.assignToSite(userId, siteId);

      res.json({
        success: true,
        message: 'User assigned to site successfully'
      });
    } catch (error) {
      console.error('Assign user to site error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to assign user to site'
      });
    }
  }
);

// DELETE /api/sites/:id/remove-user - Remove user from site
router.delete('/:id/remove-user',
  authenticate,
  adminOnly,
  [
    ...siteIdValidation,
    body('userId')
      .notEmpty()
      .withMessage('User ID is required'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (handleValidationErrors(req, res)) return;

      const siteId = req.params.id;
      const { userId } = req.body;

      // Remove user from site
      await UserRepository.removeFromSite(userId, siteId);

      res.json({
        success: true,
        message: 'User removed from site successfully'
      });
    } catch (error) {
      console.error('Remove user from site error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to remove user from site'
      });
    }
  }
);

// DELETE /api/sites/:id - Delete site
router.delete('/:id',
  authenticate,
  adminOnly,
  siteIdValidation,
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (handleValidationErrors(req, res)) return;

      const siteId = req.params.id;
      
      // Check if site exists
      const site = await SiteRepository.findById(siteId);
      if (!site) {
        res.status(404).json({
          success: false,
          message: 'Site not found'
        });
        return;
      }

      // Check if site has workers (prevent deletion if workers exist)
      const workers = await SiteRepository.getWorkers(siteId);
      if (workers.length > 0) {
        res.status(400).json({
          success: false,
          message: 'Cannot delete site with active workers. Remove workers first.'
        });
        return;
      }

      // Delete site
      const deleted = await SiteRepository.delete(siteId);
      
      if (!deleted) {
        res.status(500).json({
          success: false,
          message: 'Failed to delete site'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Site deleted successfully'
      });
    } catch (error) {
      console.error('Delete site error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete site'
      });
    }
  }
);

export default router;
