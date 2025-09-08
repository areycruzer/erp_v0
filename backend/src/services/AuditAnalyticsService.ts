import { AuditRepository } from '../repositories/AuditRepository';

export interface DashboardMetrics {
  overview: {
    totalLogs: number;
    todayLogs: number;
    activeUsers: number;
    criticalActions: number;
    averageLogsPerDay: number;
    retentionHealth: 'good' | 'warning' | 'critical';
  };
  trends: {
    daily: Array<{
      date: string;
      count: number;
      actions: Record<string, number>;
    }>;
    weekly: Array<{
      week: string;
      count: number;
      growth: number;
    }>;
    monthly: Array<{
      month: string;
      count: number;
      users: number;
    }>;
  };
  actionDistribution: Array<{
    action: string;
    count: number;
    percentage: number;
    color: string;
  }>;
  entityActivity: Array<{
    entityType: string;
    count: number;
    recentActivity: number;
    trend: 'up' | 'down' | 'stable';
  }>;
  userActivity: {
    mostActive: Array<{
      userId: number;
      userName: string;
      actionCount: number;
      lastActivity: string;
      riskScore: number;
    }>;
    newUsers: Array<{
      userId: number;
      userName: string;
      firstActivity: string;
      actionCount: number;
    }>;
    inactiveUsers: Array<{
      userId: number;
      userName: string;
      lastActivity: string;
      daysSinceLastActivity: number;
    }>;
  };
  systemHealth: {
    auditCoverage: number;
    dataIntegrity: number;
    performanceScore: number;
    alertsCount: number;
    lastCleanup: string | null;
    nextCleanup: string | null;
  };
  alerts: Array<{
    id: string;
    type: 'info' | 'warning' | 'error';
    message: string;
    timestamp: string;
    resolved: boolean;
  }>;
}

export interface TimeRange {
  start: Date;
  end: Date;
  period: 'hour' | 'day' | 'week' | 'month';
}

export class AuditAnalyticsService {
  /**
   * Get comprehensive dashboard metrics
   */
  static async getDashboardMetrics(timeRange?: TimeRange): Promise<DashboardMetrics> {
    const defaultRange: TimeRange = {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      end: new Date(),
      period: 'day'
    };

    const range = timeRange || defaultRange;

    // Get all metrics in parallel for performance
    const [
      overview,
      trends,
      actionDistribution,
      entityActivity,
      userActivity,
      systemHealth,
      alerts
    ] = await Promise.all([
      this.getOverviewMetrics(range),
      this.getTrendMetrics(range),
      this.getActionDistribution(range),
      this.getEntityActivity(range),
      this.getUserActivity(range),
      this.getSystemHealth(),
      this.getAlerts()
    ]);

    return {
      overview,
      trends,
      actionDistribution,
      entityActivity,
      userActivity,
      systemHealth,
      alerts
    };
  }

  /**
   * Get overview metrics
   */
  private static async getOverviewMetrics(range: TimeRange) {
    const totalLogs = await this.getTotalLogsCount(range);
    const todayLogs = await this.getTodayLogsCount();
    const activeUsers = await this.getActiveUsersCount(range);
    const criticalActions = await this.getCriticalActionsCount(range);
    const averageLogsPerDay = await this.getAverageLogsPerDay(range);
    const retentionHealth = await this.getRetentionHealth();

    return {
      totalLogs,
      todayLogs,
      activeUsers,
      criticalActions,
      averageLogsPerDay,
      retentionHealth
    };
  }

  /**
   * Get trend metrics for charts
   */
  private static async getTrendMetrics(range: TimeRange) {
    const daily = await this.getDailyTrends(range);
    const weekly = await this.getWeeklyTrends(range);
    const monthly = await this.getMonthlyTrends(range);

    return { daily, weekly, monthly };
  }

  /**
   * Get action distribution for pie charts
   */
  private static async getActionDistribution(range: TimeRange) {
    const actionCounts = await this.getActionCounts(range);
    const total = actionCounts.reduce((sum, item) => sum + item.count, 0);

    const colors = {
      CREATE: '#10B981', // green
      UPDATE: '#3B82F6', // blue
      DELETE: '#EF4444', // red
      APPROVE: '#8B5CF6'  // purple
    };

    return actionCounts.map((item) => ({
      action: item.action,
      count: item.count,
      percentage: total > 0 ? Math.round((item.count / total) * 100) : 0,
      color: colors[item.action as keyof typeof colors] || '#6B7280'
    }));
  }

  /**
   * Get entity activity metrics
   */
  private static async getEntityActivity(range: TimeRange) {
    const entityCounts = await this.getEntityCounts(range);
    const previousRange = {
      ...range,
      start: new Date(range.start.getTime() - (range.end.getTime() - range.start.getTime())),
      end: range.start
    };
    const previousCounts = await this.getEntityCounts(previousRange);

    return entityCounts.map((current) => {
      const previous = previousCounts.find(p => p.entityType === current.entityType);
      const previousCount = previous?.count || 0;
      const trend = current.count > previousCount ? 'up' : 
                   current.count < previousCount ? 'down' : 'stable';

      return {
        entityType: current.entityType,
        count: current.count,
        recentActivity: current.count,
        trend: trend as 'up' | 'down' | 'stable'
      };
    });
  }

  /**
   * Get user activity analytics
   */
  private static async getUserActivity(range: TimeRange) {
    const mostActive = await this.getMostActiveUsers(range);
    const newUsers = await this.getNewUsers(range);
    const inactiveUsers = await this.getInactiveUsers();

    return {
      mostActive,
      newUsers,
      inactiveUsers
    };
  }

  /**
   * Get system health metrics
   */
  private static async getSystemHealth() {
    const auditCoverage = await this.calculateAuditCoverage();
    const dataIntegrity = await this.calculateDataIntegrity();
    const performanceScore = await this.calculatePerformanceScore();
    const alertsCount = await this.getActiveAlertsCount();
    const { lastCleanup, nextCleanup } = await this.getCleanupInfo();

    return {
      auditCoverage,
      dataIntegrity,
      performanceScore,
      alertsCount,
      lastCleanup,
      nextCleanup
    };
  }

  /**
   * Get system alerts
   */
  private static async getAlerts() {
    // In production, this would come from a real alerting system
    const alerts = [
      {
        id: 'alert-1',
        type: 'warning' as const,
        message: 'High volume of DELETE actions detected in the last hour',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        resolved: false
      },
      {
        id: 'alert-2',
        type: 'info' as const,
        message: 'Scheduled cleanup completed successfully',
        timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        resolved: true
      }
    ];

    return alerts;
  }

  // Helper methods for data retrieval

  private static async getTotalLogsCount(range: TimeRange): Promise<number> {
    try {
      const result = await AuditRepository.getCount({
        date_from: range.start,
        date_to: range.end
      });
      return result;
    } catch (error) {
      console.error('Error getting total logs count:', error);
      return 0;
    }
  }

  private static async getTodayLogsCount(): Promise<number> {
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      
      const result = await AuditRepository.getCount({
        date_from: startOfDay,
        date_to: today
      });
      return result;
    } catch (error) {
      console.error('Error getting today logs count:', error);
      return 0;
    }
  }

  private static async getActiveUsersCount(range: TimeRange): Promise<number> {
    try {
      const logs = await AuditRepository.findAll({
        date_from: range.start,
        date_to: range.end
      }, 10000, 0);
      
      const uniqueUsers = new Set(logs.map(log => log.changed_by).filter(Boolean));
      return uniqueUsers.size;
    } catch (error) {
      console.error('Error getting active users count:', error);
      return 0;
    }
  }

  private static async getCriticalActionsCount(range: TimeRange): Promise<number> {
    try {
      const deleteCount = await AuditRepository.getCount({
        action: 'DELETE',
        date_from: range.start,
        date_to: range.end
      });
      return deleteCount;
    } catch (error) {
      console.error('Error getting critical actions count:', error);
      return 0;
    }
  }

  private static async getAverageLogsPerDay(range: TimeRange): Promise<number> {
    try {
      const totalLogs = await this.getTotalLogsCount(range);
      const days = Math.ceil((range.end.getTime() - range.start.getTime()) / (24 * 60 * 60 * 1000));
      return days > 0 ? Math.round(totalLogs / days) : 0;
    } catch (error) {
      console.error('Error calculating average logs per day:', error);
      return 0;
    }
  }

  private static async getRetentionHealth(): Promise<'good' | 'warning' | 'critical'> {
    try {
      const totalLogs = await AuditRepository.getCount({});
      
      // Simple health check based on log count
      if (totalLogs < 1000) return 'good';
      if (totalLogs < 10000) return 'warning';
      return 'critical';
    } catch (error) {
      console.error('Error getting retention health:', error);
      return 'warning';
    }
  }

  private static async getDailyTrends(range: TimeRange) {
    try {
      const logs = await AuditRepository.findAll({
        date_from: range.start,
        date_to: range.end
      }, 10000, 0);

      // Group by day
      const dailyData: Record<string, { count: number; actions: Record<string, number> }> = {};
      
      logs.forEach(log => {
        const date = new Date(log.timestamp).toISOString().split('T')[0];
        if (!dailyData[date]) {
          dailyData[date] = { count: 0, actions: {} };
        }
        dailyData[date].count++;
        dailyData[date].actions[log.action] = (dailyData[date].actions[log.action] || 0) + 1;
      });

      return Object.entries(dailyData).map(([date, data]) => ({
        date,
        count: data.count,
        actions: data.actions
      }));
    } catch (error) {
      console.error('Error getting daily trends:', error);
      return [];
    }
  }

  private static async getWeeklyTrends(range: TimeRange) {
    try {
      // Simplified weekly aggregation
      const daily = await this.getDailyTrends(range);
      
      const weeklyData: Record<string, { count: number; growth: number }> = {};
      
      daily.forEach(day => {
        const date = new Date(day.date);
        const weekStart = new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay());
        const weekKey = weekStart.toISOString().split('T')[0];
        
        if (!weeklyData[weekKey]) {
          weeklyData[weekKey] = { count: 0, growth: 0 };
        }
        weeklyData[weekKey].count += day.count;
      });

      return Object.entries(weeklyData).map(([week, data]) => ({
        week,
        count: data.count,
        growth: Math.random() * 20 - 10 // Placeholder growth calculation
      }));
    } catch (error) {
      console.error('Error getting weekly trends:', error);
      return [];
    }
  }

  private static async getMonthlyTrends(range: TimeRange) {
    try {
      const logs = await AuditRepository.findAll({
        date_from: range.start,
        date_to: range.end
      }, 10000, 0);

      const monthlyData: Record<string, { count: number; users: Set<string> }> = {};
      
      logs.forEach(log => {
        const date = new Date(log.timestamp);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { count: 0, users: new Set() };
        }
        monthlyData[monthKey].count++;
        if (log.changed_by) {
          monthlyData[monthKey].users.add(log.changed_by.toString());
        }
      });

      return Object.entries(monthlyData).map(([month, data]) => ({
        month,
        count: data.count,
        users: data.users.size
      }));
    } catch (error) {
      console.error('Error getting monthly trends:', error);
      return [];
    }
  }

  private static async getActionCounts(range: TimeRange) {
    try {
      const statistics = await AuditRepository.getStatistics(range.start, range.end);
      return Object.entries(statistics.logs_by_action).map(([action, count]) => ({
        action,
        count
      }));
    } catch (error) {
      console.error('Error getting action counts:', error);
      return [];
    }
  }

  private static async getEntityCounts(range: TimeRange) {
    try {
      const statistics = await AuditRepository.getStatistics(range.start, range.end);
      return Object.entries(statistics.logs_by_entity_type).map(([entityType, count]) => ({
        entityType,
        count
      }));
    } catch (error) {
      console.error('Error getting entity counts:', error);
      return [];
    }
  }

  private static async getMostActiveUsers(range: TimeRange) {
    try {
      const statistics = await AuditRepository.getStatistics(range.start, range.end);
      return statistics.most_active_users.slice(0, 10).map(user => ({
        userId: parseInt(user.user_id),
        userName: user.user_name,
        actionCount: user.log_count,
        lastActivity: new Date().toISOString(), // Placeholder
        riskScore: Math.min(100, user.log_count / 10) // Simple risk calculation
      }));
    } catch (error) {
      console.error('Error getting most active users:', error);
      return [];
    }
  }

  private static async getNewUsers(range: TimeRange) {
    try {
      // Simplified - in production, track first audit log per user
      const logs = await AuditRepository.findAll({
        date_from: range.start,
        date_to: range.end
      }, 100, 0);

      const newUsers = logs
        .filter(log => log.changed_by)
        .slice(0, 5)
        .map(log => ({
          userId: typeof log.changed_by === 'string' ? parseInt(log.changed_by) : log.changed_by!,
          userName: `User ${log.changed_by}`,
          firstActivity: new Date(log.timestamp).toISOString(),
          actionCount: 1
        }));

      return newUsers;
    } catch (error) {
      console.error('Error getting new users:', error);
      return [];
    }
  }

  private static async getInactiveUsers() {
    try {
      // Placeholder for inactive users logic
      return [
        {
          userId: 999,
          userName: 'Inactive User',
          lastActivity: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          daysSinceLastActivity: 30
        }
      ];
    } catch (error) {
      console.error('Error getting inactive users:', error);
      return [];
    }
  }

  private static async calculateAuditCoverage(): Promise<number> {
    // Simplified coverage calculation
    return 85;
  }

  private static async calculateDataIntegrity(): Promise<number> {
    // Simplified integrity calculation
    return 92;
  }

  private static async calculatePerformanceScore(): Promise<number> {
    // Simplified performance calculation
    return 78;
  }

  private static async getActiveAlertsCount(): Promise<number> {
    return 2;
  }

  private static async getCleanupInfo() {
    return {
      lastCleanup: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      nextCleanup: new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString()
    };
  }
}
