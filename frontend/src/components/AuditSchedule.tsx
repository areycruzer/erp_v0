import React, { useState, useEffect } from 'react';

interface ScheduleConfig {
  id: string;
  name: string;
  cronExpression: string;
  enabled: boolean;
  retentionDays: number;
  enableArchiving: boolean;
  batchSize: number;
  nextRun?: string;
  lastRun?: string;
  lastResult?: {
    success: boolean;
    deletedCount: number;
    archivedCount: number;
    error?: string;
    executedAt: string;
  };
}

interface ScheduleStatistics {
  totalSchedules: number;
  enabledSchedules: number;
  disabledSchedules: number;
  recentExecutions: Array<{
    scheduleId: string;
    scheduleName: string;
    lastRun?: string;
    success?: boolean;
    deletedCount?: number;
    archivedCount?: number;
  }>;
}

interface ScheduleStatus {
  running: boolean;
  schedulesCount: number;
  enabledCount: number;
  uptime: number;
}

const AuditSchedule: React.FC = () => {
  const [schedules, setSchedules] = useState<ScheduleConfig[]>([]);
  const [statistics, setStatistics] = useState<ScheduleStatistics | null>(null);
  const [status, setStatus] = useState<ScheduleStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newSchedule, setNewSchedule] = useState({
    id: '',
    name: '',
    cronExpression: '0 2 * * *',
    enabled: true,
    retentionDays: 90,
    enableArchiving: true,
    batchSize: 1000
  });

  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    try {
      const response = await fetch('/api/audit/schedules', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSchedules(data.data.schedules);
        setStatistics(data.data.statistics);
        setStatus(data.data.status);
      }
    } catch (error) {
      console.error('Error fetching schedules:', error);
    } finally {
      setLoading(false);
    }
  };

  const createSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/audit/schedules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(newSchedule)
      });

      if (response.ok) {
        setShowCreateForm(false);
        setNewSchedule({
          id: '',
          name: '',
          cronExpression: '0 2 * * *',
          enabled: true,
          retentionDays: 90,
          enableArchiving: true,
          batchSize: 1000
        });
        fetchSchedules();
      } else {
        const error = await response.json();
        alert(`Error: ${error.message}`);
      }
    } catch (error) {
      console.error('Error creating schedule:', error);
      alert('Failed to create schedule');
    }
  };

  const toggleSchedule = async (id: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/audit/schedules/${id}/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ enabled })
      });

      if (response.ok) {
        fetchSchedules();
      } else {
        const error = await response.json();
        alert(`Error: ${error.message}`);
      }
    } catch (error) {
      console.error('Error toggling schedule:', error);
      alert('Failed to toggle schedule');
    }
  };

  const runSchedule = async (id: string) => {
    try {
      const response = await fetch(`/api/audit/schedules/${id}/run`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        alert(data.message);
        fetchSchedules();
      } else {
        const error = await response.json();
        alert(`Error: ${error.message}`);
      }
    } catch (error) {
      console.error('Error running schedule:', error);
      alert('Failed to run schedule');
    }
  };

  const deleteSchedule = async (id: string) => {
    if (!confirm('Are you sure you want to delete this schedule?')) {
      return;
    }

    try {
      const response = await fetch(`/api/audit/schedules/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        fetchSchedules();
      } else {
        const error = await response.json();
        alert(`Error: ${error.message}`);
      }
    } catch (error) {
      console.error('Error deleting schedule:', error);
      alert('Failed to delete schedule');
    }
  };

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getCronDescription = (cronExpression: string): string => {
    // Simple cron descriptions - in production, use a proper cron parser
    const descriptions: { [key: string]: string } = {
      '0 2 * * *': 'Daily at 2:00 AM',
      '0 1 * * 0': 'Weekly on Sunday at 1:00 AM',
      '0 0 1 * *': 'Monthly on 1st at midnight',
      '0 */6 * * *': 'Every 6 hours',
      '0 0 * * *': 'Daily at midnight'
    };
    return descriptions[cronExpression] || cronExpression;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Overview */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Schedule Service Status</h2>
        
        {status && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-500">Service Status</div>
              <div className={`text-lg font-semibold ${status.running ? 'text-green-600' : 'text-red-600'}`}>
                {status.running ? '✅ Running' : '❌ Stopped'}
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-500">Total Schedules</div>
              <div className="text-lg font-semibold text-blue-600">{status.schedulesCount}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-500">Enabled</div>
              <div className="text-lg font-semibold text-green-600">{status.enabledCount}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-500">Uptime</div>
              <div className="text-lg font-semibold text-gray-700">{formatUptime(status.uptime)}</div>
            </div>
          </div>
        )}
      </div>

      {/* Statistics */}
      {statistics && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Activity</h2>
          
          {statistics.recentExecutions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Schedule
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Run
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Results
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {statistics.recentExecutions.map((execution) => (
                    <tr key={execution.scheduleId}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {execution.scheduleName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {execution.lastRun ? new Date(execution.lastRun).toLocaleString() : 'Never'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {execution.success === true ? (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            Success
                          </span>
                        ) : execution.success === false ? (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                            Failed
                          </span>
                        ) : (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {execution.deletedCount !== undefined ? (
                          `${execution.deletedCount} deleted, ${execution.archivedCount} archived`
                        ) : (
                          'N/A'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500">No recent executions</p>
          )}
        </div>
      )}

      {/* Schedules Management */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Scheduled Cleanup Jobs</h2>
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            Create Schedule
          </button>
        </div>

        {/* Create Form Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Schedule</h3>
                <form onSubmit={createSchedule} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">ID</label>
                    <input
                      type="text"
                      value={newSchedule.id}
                      onChange={(e) => setNewSchedule({...newSchedule, id: e.target.value})}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Name</label>
                    <input
                      type="text"
                      value={newSchedule.name}
                      onChange={(e) => setNewSchedule({...newSchedule, name: e.target.value})}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Cron Expression</label>
                    <select
                      value={newSchedule.cronExpression}
                      onChange={(e) => setNewSchedule({...newSchedule, cronExpression: e.target.value})}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="0 2 * * *">Daily at 2:00 AM</option>
                      <option value="0 1 * * 0">Weekly on Sunday at 1:00 AM</option>
                      <option value="0 0 1 * *">Monthly on 1st at midnight</option>
                      <option value="0 */6 * * *">Every 6 hours</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Retention Days</label>
                    <input
                      type="number"
                      value={newSchedule.retentionDays}
                      onChange={(e) => setNewSchedule({...newSchedule, retentionDays: parseInt(e.target.value)})}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                      min="1"
                      max="3650"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Batch Size</label>
                    <input
                      type="number"
                      value={newSchedule.batchSize}
                      onChange={(e) => setNewSchedule({...newSchedule, batchSize: parseInt(e.target.value)})}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                      min="100"
                      max="50000"
                      required
                    />
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="enabled"
                      checked={newSchedule.enabled}
                      onChange={(e) => setNewSchedule({...newSchedule, enabled: e.target.checked})}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="enabled" className="ml-2 block text-sm text-gray-900">
                      Enable immediately
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="enableArchiving"
                      checked={newSchedule.enableArchiving}
                      onChange={(e) => setNewSchedule({...newSchedule, enableArchiving: e.target.checked})}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="enableArchiving" className="ml-2 block text-sm text-gray-900">
                      Enable archiving
                    </label>
                  </div>
                  <div className="flex space-x-3">
                    <button
                      type="submit"
                      className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
                    >
                      Create
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCreateForm(false)}
                      className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Schedules List */}
        <div className="space-y-4">
          {schedules.map((schedule) => (
            <div key={schedule.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <h3 className="text-lg font-medium text-gray-900">{schedule.name}</h3>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      schedule.enabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {schedule.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">ID: {schedule.id}</p>
                  <p className="text-sm text-gray-600">
                    Schedule: {getCronDescription(schedule.cronExpression)}
                  </p>
                  <p className="text-sm text-gray-600">
                    Retention: {schedule.retentionDays} days, 
                    Archiving: {schedule.enableArchiving ? 'Yes' : 'No'}, 
                    Batch: {schedule.batchSize}
                  </p>
                  {schedule.nextRun && (
                    <p className="text-sm text-gray-600">
                      Next run: {new Date(schedule.nextRun).toLocaleString()}
                    </p>
                  )}
                  {schedule.lastRun && (
                    <p className="text-sm text-gray-600">
                      Last run: {new Date(schedule.lastRun).toLocaleString()}
                      {schedule.lastResult && (
                        <span className={`ml-2 ${schedule.lastResult.success ? 'text-green-600' : 'text-red-600'}`}>
                          ({schedule.lastResult.success ? 
                            `${schedule.lastResult.deletedCount} deleted, ${schedule.lastResult.archivedCount} archived` :
                            schedule.lastResult.error
                          })
                        </span>
                      )}
                    </p>
                  )}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => toggleSchedule(schedule.id, !schedule.enabled)}
                    className={`px-3 py-1 text-sm rounded ${
                      schedule.enabled 
                        ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    {schedule.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => runSchedule(schedule.id)}
                    className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  >
                    Run Now
                  </button>
                  <button
                    onClick={() => deleteSchedule(schedule.id)}
                    className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {schedules.length === 0 && (
          <p className="text-gray-500 text-center py-8">No scheduled jobs configured</p>
        )}
      </div>
    </div>
  );
};

export default AuditSchedule;
