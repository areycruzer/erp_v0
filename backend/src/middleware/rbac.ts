import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../types/database';

// Role hierarchy levels for permission checking
const ROLE_LEVELS: Record<UserRole, number> = {
  'ADMIN': 3,
  'SITE_INCHARGE': 2,
  'FOREMAN': 1
};

// Role-based access control middleware
export const checkRole = (allowedRoles: UserRole[]) => {
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

    const userRoleLevel = ROLE_LEVELS[req.user.role];
    const requiredRoleLevel = ROLE_LEVELS[requiredRole];

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

// Specific role middleware functions
export const adminOnly = checkRole(['ADMIN']);
export const siteInchargeLevel = checkRole(['SITE_INCHARGE', 'ADMIN']);
export const managerLevel = checkRole(['FOREMAN', 'SITE_INCHARGE', 'ADMIN']);

export default {
  checkRole,
  hasMinimumRole,
  adminOnly,
  siteInchargeLevel,
  managerLevel
};
