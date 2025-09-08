import React, { useState, useEffect } from 'react';
import { SimpleBarChart, SimpleLineChart, SimplePieChart, MetricCard, ProgressBar } from './Charts';

interface DashboardMetrics {
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

const AuditAnalytics: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<number | null>(null);
  const [realTimeEnabled, setRealTimeEnabled] = useState(false);

  // Fetch dashboard metrics
  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/audit/analytics/dashboard');
      
      if (!response.ok) {
        throw new Error('Failed to fetch analytics data');
      }

      const result = await response.json();
      if (result.success) {
        setMetrics(result.data);
        setError(null);
      } else {
        throw new Error(result.message || 'Failed to fetch analytics data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  // Setup real-time updates
  useEffect(() => {
    fetchMetrics();

    if (realTimeEnabled) {
      const interval = setInterval(fetchMetrics, 30000); // Refresh every 30 seconds
      setRefreshInterval(interval as unknown as number);
    } else if (refreshInterval) {
      clearInterval(refreshInterval);
      setRefreshInterval(null);
    }

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [realTimeEnabled]);

  // Format numbers for display
  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  // Format date for display
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString();
  };

  // Get health badge color
  const getHealthColor = (health: string): string => {
    switch (health) {
      case 'good': return 'bg-green-100 text-green-800';
      case 'warning': return 'bg-yellow-100 text-yellow-800';
      case 'critical': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Get trend icon
  const getTrendIcon = (trend: string): string => {
    switch (trend) {
      case 'up': return '↗️';
      case 'down': return '↘️';
      default: return '➡️';
    }
  };

  // Get alert type color
  const getAlertColor = (type: string): string => {
    switch (type) {
      case 'info': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'error': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <span className="text-red-400">⚠️</span>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">
              Error Loading Analytics
            </h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
            </div>
            <div className="mt-4">
              <button
                type="button"
                className="bg-red-100 px-3 py-2 rounded-md text-sm font-medium text-red-800 hover:bg-red-200"
                onClick={fetchMetrics}
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No analytics data available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Analytics Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Real-time insights into system audit activity and health
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={realTimeEnabled}
              onChange={(e) => setRealTimeEnabled(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">Real-time updates</span>
          </label>
          <button
            onClick={fetchMetrics}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Logs"
          value={formatNumber(metrics.overview.totalLogs)}
          icon="📊"
          color="blue"
        />
        <MetricCard
          title="Today's Activity"
          value={formatNumber(metrics.overview.todayLogs)}
          icon="📈"
          color="green"
        />
        <MetricCard
          title="Active Users"
          value={metrics.overview.activeUsers}
          icon="👥"
          color="blue"
        />
        <MetricCard
          title="Critical Actions"
          value={metrics.overview.criticalActions}
          icon="⚠️"
          color="red"
        />
      </div>

      {/* System Health */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-medium text-gray-900 mb-4">System Health</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <ProgressBar
              label="Audit Coverage"
              value={metrics.systemHealth.auditCoverage}
              color="#3B82F6"
            />
            <ProgressBar
              label="Data Integrity"
              value={metrics.systemHealth.dataIntegrity}
              color="#10B981"
            />
            <ProgressBar
              label="Performance Score"
              value={metrics.systemHealth.performanceScore}
              color="#F59E0B"
            />
          </div>
          <div className="flex items-center justify-center">
            <div className="text-center">
              <div className={`inline-flex px-4 py-2 text-sm font-semibold rounded-full ${getHealthColor(metrics.overview.retentionHealth)}`}>
                {metrics.overview.retentionHealth.toUpperCase()}
              </div>
              <div className="text-sm text-gray-500 mt-2">Retention Health</div>
              <div className="text-xs text-gray-400 mt-1">
                {metrics.systemHealth.alertsCount} active alerts
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Distribution */}
      <div className="bg-white p-6 rounded-lg shadow">
        <SimplePieChart
          title="Action Distribution"
          data={metrics.actionDistribution.map(action => ({
            label: action.action,
            value: action.count,
            color: action.color
          }))}
        />
      </div>

      {/* Entity Activity */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Entity Activity</h2>
        <div className="space-y-4">
          {metrics.entityActivity.map((entity) => (
            <div key={entity.entityType} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">{entity.entityType}</p>
                <p className="text-sm text-gray-500">{entity.count} total actions</p>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500">{entity.recentActivity} recent</span>
                <span className="text-lg">{getTrendIcon(entity.trend)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Most Active Users */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Most Active Users</h2>
        <div className="space-y-3">
          {metrics.userActivity.mostActive.slice(0, 5).map((user) => (
            <div key={user.userId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">{user.userName}</p>
                <p className="text-sm text-gray-500">{user.actionCount} actions</p>
              </div>
              <div className="flex items-center space-x-2">
                <div className="text-sm">
                  Risk Score: 
                  <span className={`ml-1 px-2 py-1 rounded text-xs ${
                    user.riskScore > 70 ? 'bg-red-100 text-red-800' :
                    user.riskScore > 40 ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {Math.round(user.riskScore)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Alerts */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Alerts</h2>
        <div className="space-y-3">
          {metrics.alerts.filter(alert => !alert.resolved).slice(0, 5).map((alert) => (
            <div key={alert.id} className={`p-3 rounded-lg border ${getAlertColor(alert.type)}`}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{alert.message}</p>
                  <p className="text-sm opacity-75 mt-1">
                    {formatDate(alert.timestamp)}
                  </p>
                </div>
                <span className="text-xs uppercase font-semibold">
                  {alert.type}
                </span>
              </div>
            </div>
          ))}
          {metrics.alerts.filter(alert => !alert.resolved).length === 0 && (
            <p className="text-gray-500 text-center py-4">No active alerts</p>
          )}
        </div>
      </div>

      {/* Daily Trends Chart */}
      <div className="bg-white p-6 rounded-lg shadow">
        <SimpleLineChart
          title="Daily Activity Trends"
          data={metrics.trends.daily.slice(-7).map(day => ({
            x: formatDate(day.date),
            y: day.count
          }))}
          color="#3B82F6"
        />
      </div>

      {/* Entity Activity Chart */}
      <div className="bg-white p-6 rounded-lg shadow">
        <SimpleBarChart
          title="Entity Activity"
          data={metrics.entityActivity.map(entity => ({
            label: entity.entityType,
            value: entity.count,
            color: entity.trend === 'up' ? '#10B981' : entity.trend === 'down' ? '#EF4444' : '#6B7280'
          }))}
          showValues={true}
        />
      </div>
    </div>
  );
};

export default AuditAnalytics;
