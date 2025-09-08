import { Router, Request, Response } from 'express';
import { UserRepository } from '../repositories';
import { authenticate, adminOnly, canAccessUser } from '../middleware/auth';
import { body, param, query, validationResult } from 'express-validator';
import { AuthService } from '../services/AuthService';

const router = Router();

// Validation rules
const createUserValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('phone')
    .optional()
    .isMobilePhone('any')
    .withMessage('Valid phone number required'),
  body('role')
    .optional()
    .isIn(['FOREMAN', 'SITE_INCHARGE', 'ADMIN'])
    .withMessage('Invalid role'),
];

const updateUserValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('phone')
    .optional()
    .isMobilePhone('any')
    .withMessage('Valid phone number required'),
  body('role')
    .optional()
    .isIn(['FOREMAN', 'SITE_INCHARGE', 'ADMIN'])
    .withMessage('Invalid role'),
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean'),
];

const userIdValidation = [
  param('id')
    .notEmpty()
    .withMessage('User ID is required')
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

// GET /api/users - Get all users (Admin only)
router.get('/', 
  authenticate, 
  adminOnly,
  [
    query('role')
      .optional()
      .isIn(['FOREMAN', 'SITE_INCHARGE', 'ADMIN'])
      .withMessage('Invalid role filter'),
    query('is_active')
      .optional()
      .isBoolean()
      .withMessage('is_active must be a boolean'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (handleValidationErrors(req, res)) return;

      const { role, is_active, page = 1, limit = 10 } = req.query;
      
      // Convert string parameters to appropriate types
      const activeFilter = is_active === 'true' ? true : is_active === 'false' ? false : undefined;
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      // Get users with filters
      const users = await UserRepository.findAll(
        role as any,
        activeFilter
      );

      // Simple pagination (in production, this should be done at DB level)
      const paginatedUsers = users.slice(offset, offset + limitNum);
      const total = users.length;
      
      // Remove password hashes from response
      const safeUsers = paginatedUsers.map(user => {
        const { password_hash, ...safeUser } = user;
        return safeUser;
      });

      res.json({
        success: true,
        message: 'Users retrieved successfully',
        data: {
          users: safeUsers,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum)
          }
        }
      });
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve users'
      });
    }
  }
);

// GET /api/users/:id - Get user by ID
router.get('/:id',
  authenticate,
  userIdValidation,
  canAccessUser,
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (handleValidationErrors(req, res)) return;

      const userId = req.params.id;
      const user = await UserRepository.findById(userId);

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      // Remove password hash from response
      const { password_hash, ...safeUser } = user;

      res.json({
        success: true,
        message: 'User retrieved successfully',
        data: { user: safeUser }
      });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve user'
      });
    }
  }
);

// GET /api/users/:id/sites - Get user with assigned sites
router.get('/:id/sites',
  authenticate,
  userIdValidation,
  canAccessUser,
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (handleValidationErrors(req, res)) return;

      const userId = req.params.id;
      const userWithSites = await UserRepository.findByIdWithSites(userId);

      if (!userWithSites) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      // Remove password hash from response
      const { password_hash, ...safeUser } = userWithSites;

      res.json({
        success: true,
        message: 'User with sites retrieved successfully',
        data: { user: safeUser }
      });
    } catch (error) {
      console.error('Get user with sites error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve user with sites'
      });
    }
  }
);

// POST /api/users - Create new user (Admin only)
router.post('/',
  authenticate,
  adminOnly,
  createUserValidation,
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (handleValidationErrors(req, res)) return;

      const { name, email, password, phone, role } = req.body;

      // Check if user already exists
      const existingUser = await UserRepository.findByEmail(email);
      if (existingUser) {
        res.status(409).json({
          success: false,
          message: 'User with this email already exists'
        });
        return;
      }

      // Hash password
      const hashedPassword = await AuthService.hashPassword(password);

      // Create user
      const newUser = await UserRepository.create({
        name,
        email,
        password_hash: hashedPassword,
        phone: phone || '',
        role: role || 'FOREMAN',
        is_active: true
      });

      // Remove password hash from response
      const { password_hash, ...safeUser } = newUser;

      res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: { user: safeUser }
      });
    } catch (error) {
      console.error('Create user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create user'
      });
    }
  }
);

// PUT /api/users/:id - Update user
router.put('/:id',
  authenticate,
  userIdValidation,
  updateUserValidation,
  canAccessUser,
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (handleValidationErrors(req, res)) return;

      const userId = req.params.id;
      const updateData = req.body;

      // Check if user exists
      const existingUser = await UserRepository.findById(userId);
      if (!existingUser) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      // If email is being updated, check for duplicates
      if (updateData.email && updateData.email !== existingUser.email) {
        const emailExists = await UserRepository.findByEmail(updateData.email);
        if (emailExists) {
          res.status(409).json({
            success: false,
            message: 'Email already in use by another user'
          });
          return;
        }
      }

      // Only admins can change roles and active status
      const currentUser = req.user as any;
      if (currentUser.role !== 'ADMIN') {
        delete updateData.role;
        delete updateData.is_active;
      }

      // Update user
      const updatedUser = await UserRepository.update(userId, updateData);

      if (!updatedUser) {
        res.status(500).json({
          success: false,
          message: 'Failed to update user'
        });
        return;
      }

      // Remove password hash from response
      const { password_hash, ...safeUser } = updatedUser;

      res.json({
        success: true,
        message: 'User updated successfully',
        data: { user: safeUser }
      });
    } catch (error) {
      console.error('Update user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update user'
      });
    }
  }
);

// PUT /api/users/:id/activate - Activate user (Admin only)
router.put('/:id/activate',
  authenticate,
  adminOnly,
  userIdValidation,
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (handleValidationErrors(req, res)) return;

      const userId = req.params.id;
      const user = await UserRepository.update(userId, { is_active: true });

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      // Remove password hash from response
      const { password_hash, ...safeUser } = user;

      res.json({
        success: true,
        message: 'User activated successfully',
        data: { user: safeUser }
      });
    } catch (error) {
      console.error('Activate user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to activate user'
      });
    }
  }
);

// PUT /api/users/:id/deactivate - Deactivate user (Admin only)
router.put('/:id/deactivate',
  authenticate,
  adminOnly,
  userIdValidation,
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (handleValidationErrors(req, res)) return;

      const userId = req.params.id;
      const user = await UserRepository.deactivate(userId);

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      // Remove password hash from response
      const { password_hash, ...safeUser } = user;

      res.json({
        success: true,
        message: 'User deactivated successfully',
        data: { user: safeUser }
      });
    } catch (error) {
      console.error('Deactivate user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to deactivate user'
      });
    }
  }
);

// POST /api/users/:id/assign-site - Assign user to site
router.post('/:id/assign-site',
  authenticate,
  adminOnly,
  [
    ...userIdValidation,
    body('siteId')
      .notEmpty()
      .withMessage('Site ID is required')
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (handleValidationErrors(req, res)) return;

      const userId = req.params.id;
      const { siteId } = req.body;

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

// DELETE /api/users/:id/remove-site - Remove user from site
router.delete('/:id/remove-site',
  authenticate,
  adminOnly,
  [
    ...userIdValidation,
    body('siteId')
      .notEmpty()
      .withMessage('Site ID is required')
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (handleValidationErrors(req, res)) return;

      const userId = req.params.id;
      const { siteId } = req.body;

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

// DELETE /api/users/:id - Delete user (Admin only)
router.delete('/:id',
  authenticate,
  adminOnly,
  userIdValidation,
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (handleValidationErrors(req, res)) return;

      const userId = req.params.id;
      
      // Check if user exists
      const user = await UserRepository.findById(userId);
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      // Prevent deleting yourself
      const currentUser = req.user as any;
      if (currentUser.userId === userId) {
        res.status(400).json({
          success: false,
          message: 'Cannot delete your own account'
        });
        return;
      }

      // Delete user
      const deleted = await UserRepository.delete(userId);
      
      if (!deleted) {
        res.status(500).json({
          success: false,
          message: 'Failed to delete user'
        });
        return;
      }

      res.json({
        success: true,
        message: 'User deleted successfully'
      });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete user'
      });
    }
  }
);

export default router;
