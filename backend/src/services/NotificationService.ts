export interface Notification {
  id: string;
  userId: number;
  type: 'attendance_submitted' | 'attendance_approved' | 'attendance_rejected' | 'system_alert' | 'reminder';
  title: string;
  message: string;
  data?: any;
  read: boolean;
  createdAt: string;
  expiresAt?: string;
}

export interface NotificationPreferences {
  userId: number;
  emailEnabled: boolean;
  smsEnabled: boolean;
  inAppEnabled: boolean;
  attendanceSubmissions: boolean;
  attendanceApprovals: boolean;
  systemAlerts: boolean;
  reminders: boolean;
}

export interface EmailTemplate {
  type: string;
  subject: string;
  html: string;
  text: string;
}

export class NotificationService {
  private static notifications: Map<number, Notification[]> = new Map();
  private static preferences: Map<number, NotificationPreferences> = new Map();

  /**
   * Create a new notification
   */
  static async createNotification(notification: Omit<Notification, 'id' | 'createdAt'>): Promise<Notification> {
    const newNotification: Notification = {
      ...notification,
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString()
    };

    // Store notification
    const userNotifications = this.notifications.get(notification.userId) || [];
    userNotifications.push(newNotification);
    this.notifications.set(notification.userId, userNotifications);

    // Send notifications based on user preferences
    await this.sendNotification(newNotification);

    return newNotification;
  }

  /**
   * Send notification through various channels
   */
  private static async sendNotification(notification: Notification): Promise<void> {
    const preferences = await this.getUserPreferences(notification.userId);

    // Check if notification type is enabled
    if (!this.isNotificationTypeEnabled(notification.type, preferences)) {
      return;
    }

    // Send in-app notification (always sent)
    if (preferences.inAppEnabled) {
      // In-app notifications are stored in memory/database
      console.log(`In-app notification sent to user ${notification.userId}: ${notification.title}`);
    }

    // Send email notification
    if (preferences.emailEnabled) {
      await this.sendEmailNotification(notification);
    }

    // Send SMS notification
    if (preferences.smsEnabled) {
      await this.sendSMSNotification(notification);
    }
  }

  /**
   * Send email notification
   */
  private static async sendEmailNotification(notification: Notification): Promise<void> {
    try {
      const template = this.getEmailTemplate(notification.type);
      const personalizedTemplate = this.personalizeTemplate(template, notification);

      // In production, this would use a service like SendGrid, AWS SES, or Nodemailer
      console.log(`Email sent to user ${notification.userId}:`);
      console.log(`Subject: ${personalizedTemplate.subject}`);
      console.log(`Body: ${personalizedTemplate.text}`);

      // Simulate email sending
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error('Failed to send email notification:', error);
    }
  }

  /**
   * Send SMS notification
   */
  private static async sendSMSNotification(notification: Notification): Promise<void> {
    try {
      const message = this.getSMSMessage(notification);

      // In production, this would use a service like Twilio, AWS SNS, or similar
      console.log(`SMS sent to user ${notification.userId}: ${message}`);

      // Simulate SMS sending
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error('Failed to send SMS notification:', error);
    }
  }

  /**
   * Get user notifications
   */
  static async getUserNotifications(userId: number, limit: number = 50, offset: number = 0): Promise<Notification[]> {
    const userNotifications = this.notifications.get(userId) || [];
    
    // Sort by creation date (newest first)
    const sortedNotifications = userNotifications.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Apply pagination
    return sortedNotifications.slice(offset, offset + limit);
  }

  /**
   * Get unread notification count
   */
  static async getUnreadCount(userId: number): Promise<number> {
    const userNotifications = this.notifications.get(userId) || [];
    return userNotifications.filter(notification => !notification.read).length;
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(userId: number, notificationId: string): Promise<boolean> {
    const userNotifications = this.notifications.get(userId) || [];
    const notification = userNotifications.find(n => n.id === notificationId);
    
    if (notification) {
      notification.read = true;
      return true;
    }
    
    return false;
  }

  /**
   * Mark all notifications as read
   */
  static async markAllAsRead(userId: number): Promise<void> {
    const userNotifications = this.notifications.get(userId) || [];
    userNotifications.forEach(notification => {
      notification.read = true;
    });
  }

  /**
   * Delete notification
   */
  static async deleteNotification(userId: number, notificationId: string): Promise<boolean> {
    const userNotifications = this.notifications.get(userId) || [];
    const index = userNotifications.findIndex(n => n.id === notificationId);
    
    if (index !== -1) {
      userNotifications.splice(index, 1);
      this.notifications.set(userId, userNotifications);
      return true;
    }
    
    return false;
  }

  /**
   * Get user notification preferences
   */
  static async getUserPreferences(userId: number): Promise<NotificationPreferences> {
    return this.preferences.get(userId) || {
      userId,
      emailEnabled: true,
      smsEnabled: false,
      inAppEnabled: true,
      attendanceSubmissions: true,
      attendanceApprovals: true,
      systemAlerts: true,
      reminders: true
    };
  }

  /**
   * Update user notification preferences
   */
  static async updateUserPreferences(userId: number, preferences: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    const currentPreferences = await this.getUserPreferences(userId);
    const updatedPreferences = { ...currentPreferences, ...preferences };
    this.preferences.set(userId, updatedPreferences);
    return updatedPreferences;
  }

  /**
   * Clean up expired notifications
   */
  static async cleanupExpiredNotifications(): Promise<void> {
    const now = new Date();
    
    for (const [userId, userNotifications] of this.notifications.entries()) {
      const validNotifications = userNotifications.filter(notification => {
        if (!notification.expiresAt) return true;
        return new Date(notification.expiresAt) > now;
      });
      
      this.notifications.set(userId, validNotifications);
    }
  }

  // Helper methods

  private static isNotificationTypeEnabled(type: Notification['type'], preferences: NotificationPreferences): boolean {
    switch (type) {
      case 'attendance_submitted':
      case 'attendance_approved':
      case 'attendance_rejected':
        return preferences.attendanceSubmissions || preferences.attendanceApprovals;
      case 'system_alert':
        return preferences.systemAlerts;
      case 'reminder':
        return preferences.reminders;
      default:
        return true;
    }
  }

  private static getEmailTemplate(type: Notification['type']): EmailTemplate {
    const templates: Record<string, EmailTemplate> = {
      attendance_submitted: {
        type: 'attendance_submitted',
        subject: 'Attendance Submitted - {{siteName}}',
        html: '<p>Your attendance for {{siteName}} on {{date}} has been submitted successfully.</p><p>Please wait for approval from your site incharge.</p>',
        text: 'Your attendance for {{siteName}} on {{date}} has been submitted successfully. Please wait for approval from your site incharge.'
      },
      attendance_approved: {
        type: 'attendance_approved',
        subject: 'Attendance Approved - {{siteName}}',
        html: '<p>Your attendance for {{siteName}} on {{date}} has been approved.</p><p>Hours worked: {{hours}}</p>',
        text: 'Your attendance for {{siteName}} on {{date}} has been approved. Hours worked: {{hours}}'
      },
      attendance_rejected: {
        type: 'attendance_rejected',
        subject: 'Attendance Rejected - {{siteName}}',
        html: '<p>Your attendance for {{siteName}} on {{date}} has been rejected.</p><p>Reason: {{reason}}</p><p>Please contact your site incharge for more information.</p>',
        text: 'Your attendance for {{siteName}} on {{date}} has been rejected. Reason: {{reason}}. Please contact your site incharge for more information.'
      },
      system_alert: {
        type: 'system_alert',
        subject: 'System Alert - {{alertType}}',
        html: '<p>System Alert: {{message}}</p>',
        text: 'System Alert: {{message}}'
      },
      reminder: {
        type: 'reminder',
        subject: 'Reminder - {{title}}',
        html: '<p>Reminder: {{message}}</p>',
        text: 'Reminder: {{message}}'
      }
    };

    return templates[type] || templates.system_alert;
  }

  private static personalizeTemplate(template: EmailTemplate, notification: Notification): EmailTemplate {
    const data = notification.data || {};
    
    const personalize = (text: string): string => {
      return text
        .replace(/\{\{siteName\}\}/g, data.siteName || 'Unknown Site')
        .replace(/\{\{date\}\}/g, data.date || new Date().toLocaleDateString())
        .replace(/\{\{hours\}\}/g, data.hours || '0')
        .replace(/\{\{reason\}\}/g, data.reason || 'No reason provided')
        .replace(/\{\{alertType\}\}/g, data.alertType || 'General')
        .replace(/\{\{title\}\}/g, notification.title)
        .replace(/\{\{message\}\}/g, notification.message);
    };

    return {
      ...template,
      subject: personalize(template.subject),
      html: personalize(template.html),
      text: personalize(template.text)
    };
  }

  private static getSMSMessage(notification: Notification): string {
    const data = notification.data || {};
    
    switch (notification.type) {
      case 'attendance_submitted':
        return `Attendance submitted for ${data.siteName || 'site'} on ${data.date || 'today'}. Awaiting approval.`;
      case 'attendance_approved':
        return `Attendance approved for ${data.siteName || 'site'} on ${data.date || 'today'}. Hours: ${data.hours || '0'}`;
      case 'attendance_rejected':
        return `Attendance rejected for ${data.siteName || 'site'} on ${data.date || 'today'}. Contact site incharge.`;
      case 'system_alert':
        return `Alert: ${notification.message}`;
      case 'reminder':
        return `Reminder: ${notification.message}`;
      default:
        return notification.message;
    }
  }

  // Predefined notification creators

  /**
   * Create attendance submission notification
   */
  static async notifyAttendanceSubmitted(userId: number, siteName: string, date: string): Promise<Notification> {
    return await this.createNotification({
      userId,
      type: 'attendance_submitted',
      title: 'Attendance Submitted',
      message: `Your attendance for ${siteName} on ${date} has been submitted and is pending approval.`,
      data: { siteName, date },
      read: false
    });
  }

  /**
   * Create attendance approval notification
   */
  static async notifyAttendanceApproved(userId: number, siteName: string, date: string, hours: number): Promise<Notification> {
    return await this.createNotification({
      userId,
      type: 'attendance_approved',
      title: 'Attendance Approved',
      message: `Your attendance for ${siteName} on ${date} has been approved. Hours worked: ${hours}`,
      data: { siteName, date, hours },
      read: false
    });
  }

  /**
   * Create attendance rejection notification
   */
  static async notifyAttendanceRejected(userId: number, siteName: string, date: string, reason: string): Promise<Notification> {
    return await this.createNotification({
      userId,
      type: 'attendance_rejected',
      title: 'Attendance Rejected',
      message: `Your attendance for ${siteName} on ${date} has been rejected. Reason: ${reason}`,
      data: { siteName, date, reason },
      read: false
    });
  }

  /**
   * Create system alert notification
   */
  static async notifySystemAlert(userId: number, alertType: string, message: string): Promise<Notification> {
    return await this.createNotification({
      userId,
      type: 'system_alert',
      title: `System Alert: ${alertType}`,
      message,
      data: { alertType },
      read: false
    });
  }

  /**
   * Create reminder notification
   */
  static async notifyReminder(userId: number, title: string, message: string, expiresAt?: string): Promise<Notification> {
    const notification: Omit<Notification, 'id' | 'createdAt'> = {
      userId,
      type: 'reminder',
      title,
      message,
      read: false
    };

    if (expiresAt) {
      notification.expiresAt = expiresAt;
    }

    return await this.createNotification(notification);
  }
}

// Cleanup expired notifications every hour
setInterval(() => {
  NotificationService.cleanupExpiredNotifications();
}, 60 * 60 * 1000);
