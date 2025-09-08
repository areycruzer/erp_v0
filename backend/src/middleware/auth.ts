import { Request, Response, NextFunction } from 'express';
import { AuthService, AuthPayload } from '../services/AuthService';
import { UserRole } from '../types/database';

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user: AuthPayload;
}

// Authentication middleware
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'Access token required'
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Invalid token format'
      });
      return;
    }

    // Verify token
    const payload = AuthService.verifyToken(token);
    req.user = payload;
    
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

// Role-based authorization middleware factory
export const authorize = (...allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    const userRole = req.user.role;
    
    if (!allowedRoles.includes(userRole)) {
      res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
      return;
    }

    next();
  };
};

// Role hierarchy for permission checking
const ROLE_HIERARCHY: Record<UserRole, number> = {
  'ADMIN': 3,
  'SITE_INCHARGE': 2,
  'FOREMAN': 1
};

// Check if user has minimum role level
export const hasMinimumRole = (requiredRole: UserRole) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    const userRoleLevel = ROLE_HIERARCHY[req.user.role];
    const requiredRoleLevel = ROLE_HIERARCHY[requiredRole];

    if (userRoleLevel < requiredRoleLevel) {
      res.status(403).json({
        success: false,
        message: `${requiredRole} role or higher required`
      });
      return;
    }

    next();
  };
};

// Check if user can access specific user data (own data or admin privileges)
export const canAccessUser = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
    return;
  }

  const targetUserId = req.params.userId || req.params.id;
  const currentUserId = req.user.userId;
  const userRole = req.user.role;

  // Admins can access any user data
  if (userRole === 'ADMIN') {
    next();
    return;
  }

  // Users can only access their own data
  if (targetUserId === currentUserId) {
    next();
    return;
  }

  res.status(403).json({
    success: false,
    message: 'Cannot access other user data'
  });
};

// Check if user can manage workers (foreman can manage workers at their sites)
export const canManageWorkers = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
    return;
  }

  const userRole = req.user.role;

  // Admins and foremen can manage workers
  if (['ADMIN', 'SITE_INCHARGE', 'FOREMAN'].includes(userRole)) {
    next();
    return;
  }

  res.status(403).json({
    success: false,
    message: 'Insufficient permissions to manage workers'
  });
};

// Optional authentication (doesn't fail if no token provided)
export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      if (token) {
        const payload = AuthService.verifyToken(token);
        req.user = payload;
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

// Admin only middleware
export const adminOnly = authorize('ADMIN');

// Site incharge and above
export const siteInchargeLevel = authorize('SITE_INCHARGE', 'ADMIN');

// Manager level (foreman and above)
export const managerLevel = authorize('FOREMAN', 'SITE_INCHARGE', 'ADMIN');

// Export all middleware functions
export default {
  authenticate,
  authorize,
  hasMinimumRole,
  canAccessUser,
  canManageWorkers,
  optionalAuth,
  adminOnly,
  siteInchargeLevel,
  managerLevel
};
