import { Router, Request, Response } from 'express';
import { AuthService } from '../services/AuthService';
import { authenticate } from '../middleware/auth';
import { body, validationResult } from 'express-validator';

const router = Router();

// Validation rules
const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
];

const registerValidation = [
  body('name')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Name must be at least 2 characters long'),
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

// POST /api/auth/login
router.post('/login', loginValidation, async (req: Request, res: Response): Promise<void> => {
  try {
    if (handleValidationErrors(req, res)) return;

    const { email, password } = req.body;
    
    const authResponse = await AuthService.login({ email, password });
    
    res.json({
      success: true,
      message: 'Login successful',
      data: authResponse
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed';
    
    res.status(401).json({
      success: false,
      message
    });
  }
});

// POST /api/auth/register (Admin only - for creating new users)
router.post('/register', registerValidation, async (req: Request, res: Response): Promise<void> => {
  try {
    if (handleValidationErrors(req, res)) return;

    const { name, email, password, phone, role } = req.body;
    
    const authResponse = await AuthService.register({
      name,
      email,
      password,
      phone,
      role
    });
    
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: authResponse
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed';
    
    const statusCode = message.includes('already exists') ? 409 : 400;
    
    res.status(statusCode).json({
      success: false,
      message
    });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.body;
    
    if (!token) {
      res.status(400).json({
        success: false,
        message: 'Refresh token required'
      });
      return;
    }
    
    const authResponse = await AuthService.refreshToken(token);
    
    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: authResponse
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid refresh token'
    });
  }
});

// GET /api/auth/me (Get current user info)
router.get('/me', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await AuthService.getCurrentUser(
      req.headers.authorization!.substring(7) // Remove 'Bearer ' prefix
    );
    
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }
    
    res.json({
      success: true,
      message: 'User retrieved successfully',
      data: { user }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user information'
    });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (_req: Request, res: Response): Promise<void> => {
  try {
    // For stateless JWT, logout is handled client-side by removing the token
    // In a production app, you might want to maintain a blacklist of tokens
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Logout failed'
    });
  }
});

// POST /api/auth/change-password
router.post('/change-password', 
  authenticate, 
  [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 6 })
      .withMessage('New password must be at least 6 characters long'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (handleValidationErrors(req, res)) return;

      const { currentPassword, newPassword } = req.body;
      const userId = (req as any).user.userId; // Type assertion since authenticate middleware adds user
      
      // Get current user to verify password
      const user = await AuthService.getCurrentUser(
        req.headers.authorization!.substring(7)
      );
      
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }
      
      // Verify current password (we need to get the user with password hash)
      const { UserRepository } = await import('../repositories');
      const userWithPassword = await UserRepository.findById(userId);
      
      if (!userWithPassword) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }
      
      const isCurrentPasswordValid = await AuthService.verifyPassword(
        currentPassword,
        userWithPassword.password_hash
      );
      
      if (!isCurrentPasswordValid) {
        res.status(400).json({
          success: false,
          message: 'Current password is incorrect'
        });
        return;
      }
      
      // Hash new password and update
      const newPasswordHash = await AuthService.hashPassword(newPassword);
      await UserRepository.update(userId, { 
        name: userWithPassword.name, // Keep existing name
        email: userWithPassword.email, // Keep existing email
        password_hash: newPasswordHash // This will be our custom update
      } as any);
      
      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to change password'
      });
    }
  }
);

export default router;
