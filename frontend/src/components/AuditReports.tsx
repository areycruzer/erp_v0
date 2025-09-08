import React, { useState } from 'react';

interface ReportFilters {
  startDate?: string;
  endDate?: string;
  userId?: number;
  entityType?: string;
  action?: string;
  limit?: number;
}

interface ReportOptions {
  title?: string;
  includeDetails?: boolean;
  format: 'csv' | 'pdf' | 'json';
}

interface UserActivitySummary {
  userId: number;
  userName: string;
  totalActions: number;
  actionBreakdown: Record<string, number>;
  lastActivity: string;
}

const AuditReports: React.FC = () => {
  const [filters, setFilters] = useState<ReportFilters>({
    limit: 1000
  });
  const [options, setOptions] = useState<ReportOptions>({
    format: 'csv',
    includeDetails: false
  });
  const [loading, setLoading] = useState(false);
  const [userActivityLoading, setUserActivityLoading] = useState(false);
  const [userSummary, setUserSummary] = useState<UserActivitySummary | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | ''>('');

  const handleFilterChange = (field: keyof ReportFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [field]: value || undefined
    }));
  };

  const handleOptionChange = (field: keyof ReportOptions, value: any) => {
    setOptions(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const generateReport = async () => {
    if (loading) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/audit/reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          ...filters,
          ...options
        })
      });

      if (response.ok) {
        // Handle file download
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit_report_${Date.now()}.${options.format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const error = await response.json();
        alert(`Error: ${error.message}`);
      }
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const generateUserActivityReport = async () => {
    if (userActivityLoading || !selectedUserId) return;
    
    setUserActivityLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      params.append('format', 'json');

      const response = await fetch(`/api/audit/reports/user/${selectedUserId}?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUserSummary(data.data.summary);
      } else {
        const error = await response.json();
        alert(`Error: ${error.message}`);
      }
    } catch (error) {
      console.error('Error generating user activity report:', error);
      alert('Failed to generate user activity report');
    } finally {
      setUserActivityLoading(false);
    }
  };

  const downloadUserActivityReport = async (format: 'csv' | 'json') => {
    if (!selectedUserId) return;
    
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      params.append('format', format);

      const response = await fetch(`/api/audit/reports/user/${selectedUserId}?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        if (format === 'csv') {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `user_activity_${selectedUserId}_${Date.now()}.csv`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        } else {
          const data = await response.json();
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `user_activity_${selectedUserId}_${Date.now()}.json`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        }
      } else {
        const error = await response.json();
        alert(`Error: ${error.message}`);
      }
    } catch (error) {
      console.error('Error downloading user activity report:', error);
      alert('Failed to download user activity report');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Generate Audit Reports</h2>
        
        {/* Filters Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={filters.startDate || ''}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={filters.endDate || ''}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              User ID
            </label>
            <input
              type="number"
              value={filters.userId || ''}
              onChange={(e) => handleFilterChange('userId', parseInt(e.target.value) || undefined)}
              placeholder="All users"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Entity Type
            </label>
            <select
              value={filters.entityType || ''}
              onChange={(e) => handleFilterChange('entityType', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All entities</option>
              <option value="attendance">Attendance</option>
              <option value="user">User</option>
              <option value="site">Site</option>
              <option value="worker">Worker</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Action
            </label>
            <select
              value={filters.action || ''}
              onChange={(e) => handleFilterChange('action', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All actions</option>
              <option value="CREATE">Create</option>
              <option value="UPDATE">Update</option>
              <option value="DELETE">Delete</option>
              <option value="APPROVE">Approve</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Limit
            </label>
            <input
              type="number"
              value={filters.limit || ''}
              onChange={(e) => handleFilterChange('limit', parseInt(e.target.value) || undefined)}
              placeholder="1000"
              min="1"
              max="50000"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Report Options */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Format
            </label>
            <select
              value={options.format}
              onChange={(e) => handleOptionChange('format', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="csv">CSV</option>
              <option value="pdf">PDF (HTML)</option>
              <option value="json">JSON</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Report Title
            </label>
            <input
              type="text"
              value={options.title || ''}
              onChange={(e) => handleOptionChange('title', e.target.value)}
              placeholder="Audit Compliance Report"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="includeDetails"
              checked={options.includeDetails}
              onChange={(e) => handleOptionChange('includeDetails', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="includeDetails" className="ml-2 block text-sm text-gray-900">
              Include detailed user activities
            </label>
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={generateReport}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Generating Report...
            </>
          ) : (
            'Generate Audit Report'
          )}
        </button>
      </div>

      {/* User Activity Report Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">User Activity Report</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              User ID
            </label>
            <input
              type="number"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(parseInt(e.target.value) || '')}
              placeholder="Enter user ID"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex space-x-3 mb-4">
          <button
            onClick={generateUserActivityReport}
            disabled={userActivityLoading || !selectedUserId}
            className="bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {userActivityLoading ? 'Loading...' : 'View Summary'}
          </button>
          
          <button
            onClick={() => downloadUserActivityReport('csv')}
            disabled={!selectedUserId}
            className="bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Download CSV
          </button>
          
          <button
            onClick={() => downloadUserActivityReport('json')}
            disabled={!selectedUserId}
            className="bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Download JSON
          </button>
        </div>

        {/* User Summary Display */}
        {userSummary && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-3">
              Activity Summary for {userSummary.userName}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-3 rounded shadow">
                <div className="text-sm text-gray-500">Total Actions</div>
                <div className="text-2xl font-semibold text-blue-600">{userSummary.totalActions}</div>
              </div>
              <div className="bg-white p-3 rounded shadow">
                <div className="text-sm text-gray-500">Last Activity</div>
                <div className="text-sm font-medium">{new Date(userSummary.lastActivity).toLocaleDateString()}</div>
              </div>
              <div className="bg-white p-3 rounded shadow md:col-span-2">
                <div className="text-sm text-gray-500 mb-2">Action Breakdown</div>
                <div className="space-y-1">
                  {Object.entries(userSummary.actionBreakdown).map(([action, count]) => (
                    <div key={action} className="flex justify-between text-sm">
                      <span>{action}:</span>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditReports;
