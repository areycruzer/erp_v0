import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { NotificationService } from '../services/NotificationService';
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

// GET /notifications - Get user notifications
router.get('/',
  authenticate,
  [
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be a non-negative integer'),
    query('unread_only').optional().isBoolean().withMessage('unread_only must be a boolean')
  ],
  handleValidationErrors,
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const userId = parseInt(req.user!.userId);
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const unreadOnly = req.query.unread_only === 'true';

      let notifications = await NotificationService.getUserNotifications(userId, limit, offset);
      
      if (unreadOnly) {
        notifications = notifications.filter(notification => !notification.read);
      }

      const unreadCount = await NotificationService.getUnreadCount(userId);

      res.json({
        success: true,
        data: {
          notifications,
          unreadCount,
          total: notifications.length
        }
      });
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch notifications',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// GET /notifications/unread-count - Get unread notification count
router.get('/unread-count',
  authenticate,
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const userId = parseInt(req.user!.userId);
      const unreadCount = await NotificationService.getUnreadCount(userId);

      res.json({
        success: true,
        data: { unreadCount }
      });
    } catch (error) {
      console.error('Error getting unread count:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get unread count',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// PUT /notifications/:id/read - Mark notification as read
router.put('/:id/read',
  authenticate,
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const userId = parseInt(req.user!.userId);
      const notificationId = req.params.id;

      const success = await NotificationService.markAsRead(userId, notificationId);

      if (!success) {
        res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Notification marked as read'
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark notification as read',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// PUT /notifications/read-all - Mark all notifications as read
router.put('/read-all',
  authenticate,
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const userId = parseInt(req.user!.userId);
      await NotificationService.markAllAsRead(userId);

      res.json({
        success: true,
        message: 'All notifications marked as read'
      });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark all notifications as read',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// DELETE /notifications/:id - Delete notification
router.delete('/:id',
  authenticate,
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const userId = parseInt(req.user!.userId);
      const notificationId = req.params.id;

      const success = await NotificationService.deleteNotification(userId, notificationId);

      if (!success) {
        res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Notification deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting notification:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete notification',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// GET /notifications/preferences - Get user notification preferences
router.get('/preferences',
  authenticate,
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const userId = parseInt(req.user!.userId);
      const preferences = await NotificationService.getUserPreferences(userId);

      res.json({
        success: true,
        data: preferences
      });
    } catch (error) {
      console.error('Error getting notification preferences:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get notification preferences',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// PUT /notifications/preferences - Update user notification preferences
router.put('/preferences',
  authenticate,
  [
    body('emailEnabled').optional().isBoolean().withMessage('emailEnabled must be a boolean'),
    body('smsEnabled').optional().isBoolean().withMessage('smsEnabled must be a boolean'),
    body('inAppEnabled').optional().isBoolean().withMessage('inAppEnabled must be a boolean'),
    body('attendanceSubmissions').optional().isBoolean().withMessage('attendanceSubmissions must be a boolean'),
    body('attendanceApprovals').optional().isBoolean().withMessage('attendanceApprovals must be a boolean'),
    body('systemAlerts').optional().isBoolean().withMessage('systemAlerts must be a boolean'),
    body('reminders').optional().isBoolean().withMessage('reminders must be a boolean')
  ],
  handleValidationErrors,
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const userId = parseInt(req.user!.userId);
      const updates = req.body;

      const updatedPreferences = await NotificationService.updateUserPreferences(userId, updates);

      res.json({
        success: true,
        data: updatedPreferences,
        message: 'Notification preferences updated successfully'
      });
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update notification preferences',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// POST /notifications/test - Send test notification (Admin only)
router.post('/test',
  authenticate,
  checkRole(['ADMIN']),
  [
    body('userId').isInt({ min: 1 }).withMessage('userId must be a positive integer'),
    body('type').isIn(['attendance_submitted', 'attendance_approved', 'attendance_rejected', 'system_alert', 'reminder']).withMessage('Invalid notification type'),
    body('title').isString().trim().isLength({ min: 1, max: 200 }).withMessage('Title must be 1-200 characters'),
    body('message').isString().trim().isLength({ min: 1, max: 1000 }).withMessage('Message must be 1-1000 characters'),
    body('data').optional().isObject().withMessage('Data must be an object')
  ],
  handleValidationErrors,
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { userId, type, title, message, data } = req.body;

      const notification = await NotificationService.createNotification({
        userId,
        type,
        title,
        message,
        data,
        read: false
      });

      res.json({
        success: true,
        data: notification,
        message: 'Test notification sent successfully'
      });
    } catch (error) {
      console.error('Error sending test notification:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send test notification',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// POST /notifications/broadcast - Send broadcast notification (Admin only)
router.post('/broadcast',
  authenticate,
  checkRole(['ADMIN']),
  [
    body('userIds').isArray({ min: 1 }).withMessage('userIds must be a non-empty array'),
    body('userIds.*').isInt({ min: 1 }).withMessage('Each userId must be a positive integer'),
    body('type').isIn(['system_alert', 'reminder']).withMessage('Broadcast type must be system_alert or reminder'),
    body('title').isString().trim().isLength({ min: 1, max: 200 }).withMessage('Title must be 1-200 characters'),
    body('message').isString().trim().isLength({ min: 1, max: 1000 }).withMessage('Message must be 1-1000 characters'),
    body('data').optional().isObject().withMessage('Data must be an object'),
    body('expiresAt').optional().isISO8601().withMessage('expiresAt must be a valid ISO date')
  ],
  handleValidationErrors,
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { userIds, type, title, message, data, expiresAt } = req.body;

      const notifications = await Promise.all(
        userIds.map((userId: number) =>
          NotificationService.createNotification({
            userId,
            type,
            title,
            message,
            data,
            read: false,
            expiresAt
          })
        )
      );

      res.json({
        success: true,
        data: {
          notificationsSent: notifications.length,
          notifications
        },
        message: `Broadcast notification sent to ${notifications.length} users`
      });
    } catch (error) {
      console.error('Error sending broadcast notification:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send broadcast notification',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

export { router as notificationRouter };
