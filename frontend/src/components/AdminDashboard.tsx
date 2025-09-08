import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { attendanceApi, workersApi, sitesApi } from '../lib/api';
import LoadingSpinner from './LoadingSpinner';

interface DashboardStats {
  totalWorkers: number;
  activeWorkers: number;
  totalSites: number;
  totalUsers: number;
  todayAttendance: number;
  pendingApprovals: number;
  thisWeekSubmissions: number;
  thisMonthSubmissions: number;
}

interface RecentActivity {
  id: string;
  type: 'attendance_submitted' | 'attendance_approved' | 'attendance_rejected' | 'user_created' | 'worker_added';
  description: string;
  timestamp: string;
  user: string;
}

interface SystemHealth {
  database: 'healthy' | 'warning' | 'error';
  notifications: 'healthy' | 'warning' | 'error';
  audit: 'healthy' | 'warning' | 'error';
  storage: 'healthy' | 'warning' | 'error';
}

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalWorkers: 0,
    activeWorkers: 0,
    totalSites: 0,
    totalUsers: 0,
    todayAttendance: 0,
    pendingApprovals: 0,
    thisWeekSubmissions: 0,
    thisMonthSubmissions: 0
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    database: 'healthy',
    notifications: 'healthy',
    audit: 'healthy',
    storage: 'healthy'
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      if (!loading) setRefreshing(true);
      
      const [workersResponse, sitesResponse, attendanceResponse] = await Promise.all([
        workersApi.getAll(),
        sitesApi.getAll(),
        attendanceApi.getAll({ limit: 100 })
      ]);

      // Calculate stats
      const workers = workersResponse.workers || [];
      const sites = sitesResponse || [];
      const attendance = attendanceResponse.attendance || [];

      // Mock users count - in production this would come from a users API
      const mockUsersCount = 15;

      const today = new Date().toISOString().split('T')[0];
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const newStats: DashboardStats = {
        totalWorkers: workers.length,
        activeWorkers: workers.filter((w: any) => w.is_active).length,
        totalSites: sites.length,
        totalUsers: mockUsersCount,
        todayAttendance: attendance.filter((a: any) => a.date === today).length,
        pendingApprovals: attendance.filter((a: any) => a.status === 'PENDING').length,
        thisWeekSubmissions: attendance.filter((a: any) => a.date >= oneWeekAgo).length,
        thisMonthSubmissions: attendance.filter((a: any) => a.date >= oneMonthAgo).length
      };

      setStats(newStats);

      // Mock recent activity - in production this would come from audit logs
      const mockActivity: RecentActivity[] = [
        {
          id: '1',
          type: 'attendance_submitted',
          description: 'New attendance submitted for Site A',
          timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          user: 'Foreman John'
        },
        {
          id: '2',
          type: 'attendance_approved',
          description: 'Attendance approved for 10 workers',
          timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          user: 'Site Incharge Mary'
        },
        {
          id: '3',
          type: 'worker_added',
          description: 'New worker added to system',
          timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          user: 'Admin User'
        }
      ];

      setRecentActivity(mockActivity);

      // Mock system health - in production this would be real monitoring
      setSystemHealth({
        database: 'healthy',
        notifications: 'healthy',
        audit: 'healthy',
        storage: 'healthy'
      });

    } catch (err) {
      setError('Failed to load dashboard data');
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-100';
      case 'warning':
        return 'text-yellow-600 bg-yellow-100';
      case 'error':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return '✅';
      case 'warning':
        return '⚠️';
      case 'error':
        return '❌';
      default:
        return '❓';
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'attendance_submitted':
        return '📝';
      case 'attendance_approved':
        return '✅';
      case 'attendance_rejected':
        return '❌';
      case 'user_created':
        return '👤';
      case 'worker_added':
        return '👷';
      default:
        return '📊';
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner />
          <p className="mt-4 text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg p-8 text-center shadow-sm border max-w-md w-full">
          <div className="text-4xl mb-4">❌</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Dashboard</h3>
          <p className="text-gray-500 mb-4">{error}</p>
          <button
            onClick={loadDashboardData}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">👑 Admin Dashboard</h1>
              <p className="text-gray-600">Welcome back, {user?.name}</p>
            </div>
            <button
              onClick={loadDashboardData}
              disabled={refreshing}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center text-sm"
            >
              {refreshing ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span className="ml-2">Refreshing...</span>
                </>
              ) : (
                <>🔄 Refresh</>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 lg:p-6 space-y-6">
        {/* Key Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Workers</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalWorkers}</p>
                <p className="text-xs text-green-600">{stats.activeWorkers} active</p>
              </div>
              <div className="text-3xl">👷</div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Sites</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalSites}</p>
                <p className="text-xs text-blue-600">Active sites</p>
              </div>
              <div className="text-3xl">🏗️</div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Today's Attendance</p>
                <p className="text-2xl font-bold text-gray-900">{stats.todayAttendance}</p>
                <p className="text-xs text-purple-600">Submissions</p>
              </div>
              <div className="text-3xl">📊</div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Pending Approvals</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.pendingApprovals}</p>
                <p className="text-xs text-yellow-600">Awaiting review</p>
              </div>
              <div className="text-3xl">⏳</div>
            </div>
          </div>
        </div>

        {/* Additional Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">📈 Submission Trends</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">This Week</span>
                <span className="font-semibold text-blue-600">{stats.thisWeekSubmissions}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">This Month</span>
                <span className="font-semibold text-green-600">{stats.thisMonthSubmissions}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total Users</span>
                <span className="font-semibold text-purple-600">{stats.totalUsers}</span>
              </div>
            </div>
          </div>

          {/* System Health */}
          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">🔧 System Health</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Database</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getHealthColor(systemHealth.database)}`}>
                  {getHealthIcon(systemHealth.database)} {systemHealth.database}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Notifications</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getHealthColor(systemHealth.notifications)}`}>
                  {getHealthIcon(systemHealth.notifications)} {systemHealth.notifications}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Audit System</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getHealthColor(systemHealth.audit)}`}>
                  {getHealthIcon(systemHealth.audit)} {systemHealth.audit}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Storage</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getHealthColor(systemHealth.storage)}`}>
                  {getHealthIcon(systemHealth.storage)} {systemHealth.storage}
                </span>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">🕒 Recent Activity</h3>
            <div className="space-y-3">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="border-l-2 border-blue-200 pl-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-2">
                      <span className="text-lg">{getActivityIcon(activity.type)}</span>
                      <div>
                        <p className="text-sm text-gray-900">{activity.description}</p>
                        <p className="text-xs text-gray-500">by {activity.user}</p>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400">{formatTimeAgo(activity.timestamp)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">⚡ Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-center">
              <div className="text-2xl mb-2">👥</div>
              <div className="text-sm font-medium text-gray-900">Manage Users</div>
            </button>
            <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-center">
              <div className="text-2xl mb-2">🏗️</div>
              <div className="text-sm font-medium text-gray-900">Manage Sites</div>
            </button>
            <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-center">
              <div className="text-2xl mb-2">📊</div>
              <div className="text-sm font-medium text-gray-900">View Reports</div>
            </button>
            <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-center">
              <div className="text-2xl mb-2">⚙️</div>
              <div className="text-sm font-medium text-gray-900">System Settings</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
