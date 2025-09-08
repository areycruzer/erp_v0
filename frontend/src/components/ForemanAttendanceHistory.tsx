import React, { useState, useEffect } from 'react';
import { attendanceApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from './LoadingSpinner';

interface AttendanceRecord {
  id: string;
  worker_id: string;
  worker_name: string;
  site_id: string;
  site_name: string;
  date: string;
  P: number;
  A: number;
  HD: number;
  interpretation_mode: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  submitted_by: number;
  approved_by?: number;
  approved_at?: string;
  created_at: string;
  updated_at: string;
}

interface GroupedAttendance {
  [key: string]: AttendanceRecord[];
}

const ForemanAttendanceHistory: React.FC = () => {
  const { user } = useAuth();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'site' | 'status'>('date');

  useEffect(() => {
    loadAttendanceHistory();
  }, []);

  const loadAttendanceHistory = async () => {
    try {
      setLoading(true);
      const response = await attendanceApi.getAll({
        limit: 100,
        offset: 0
      });
      
      // Transform and filter for current user's submissions
      const transformedHistory = (response.attendance || [])
        .map((record: any) => ({
          ...record,
          worker_name: record.worker_name || 'Unknown Worker',
          site_name: record.site_name || 'Unknown Site'
        }))
        .filter((record: AttendanceRecord) => record.submitted_by === parseInt(user?.id || '0'));
        
      setAttendance(transformedHistory);
    } catch (err) {
      setError('Failed to load attendance history');
      console.error('Error loading attendance history:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredAttendance = attendance.filter(record => {
    if (filter === 'all') return true;
    return record.status.toLowerCase() === filter;
  });

  const sortedAttendance = [...filteredAttendance].sort((a, b) => {
    switch (sortBy) {
      case 'date':
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      case 'site':
        return a.site_name.localeCompare(b.site_name);
      case 'status':
        return a.status.localeCompare(b.status);
      default:
        return 0;
    }
  });

  // Group by date for better mobile viewing
  const groupedAttendance = sortedAttendance.reduce((groups: GroupedAttendance, record) => {
    const date = record.date;
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(record);
    return groups;
  }, {});

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'REJECTED':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return '✅';
      case 'REJECTED':
        return '❌';
      case 'PENDING':
        return '⏳';
      default:
        return '❓';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusCounts = () => {
    return {
      total: attendance.length,
      pending: attendance.filter(r => r.status === 'PENDING').length,
      approved: attendance.filter(r => r.status === 'APPROVED').length,
      rejected: attendance.filter(r => r.status === 'REJECTED').length
    };
  };

  const statusCounts = getStatusCounts();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner />
          <p className="mt-4 text-gray-600">Loading attendance history...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg p-8 text-center shadow-sm border max-w-md w-full">
          <div className="text-4xl mb-4">❌</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading History</h3>
          <p className="text-gray-500 mb-4">{error}</p>
          <button
            onClick={loadAttendanceHistory}
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
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="px-4 py-4">
          <h1 className="text-lg font-semibold text-gray-900">📊 Attendance History</h1>
          <p className="text-sm text-gray-500">Your submitted attendance records</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="p-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div className="bg-white rounded-lg p-3 border shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Total</p>
                <p className="text-lg font-semibold text-gray-900">{statusCounts.total}</p>
              </div>
              <div className="text-xl">📋</div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-3 border shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Pending</p>
                <p className="text-lg font-semibold text-yellow-600">{statusCounts.pending}</p>
              </div>
              <div className="text-xl">⏳</div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-3 border shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Approved</p>
                <p className="text-lg font-semibold text-green-600">{statusCounts.approved}</p>
              </div>
              <div className="text-xl">✅</div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-3 border shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Rejected</p>
                <p className="text-lg font-semibold text-red-600">{statusCounts.rejected}</p>
              </div>
              <div className="text-xl">❌</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg p-4 shadow-sm border mb-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Filter by Status</label>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Sort by</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="date">Date</option>
                <option value="site">Site</option>
                <option value="status">Status</option>
              </select>
            </div>
          </div>
        </div>

        {/* Attendance Records */}
        <div className="space-y-4">
          {Object.keys(groupedAttendance).length === 0 ? (
            <div className="bg-white rounded-lg p-8 text-center shadow-sm border">
              <div className="text-4xl mb-4">📋</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Records Found</h3>
              <p className="text-gray-500">
                {filter === 'all' 
                  ? "You haven't submitted any attendance records yet." 
                  : `No ${filter} attendance records found.`}
              </p>
            </div>
          ) : (
            Object.entries(groupedAttendance).map(([date, records]) => (
              <div key={date} className="bg-white rounded-lg shadow-sm border overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b">
                  <h3 className="font-medium text-gray-900">{formatDate(date)}</h3>
                  <p className="text-sm text-gray-500">{records.length} record{records.length > 1 ? 's' : ''}</p>
                </div>
                
                <div className="divide-y divide-gray-200">
                  {records.map((record) => (
                    <div key={record.id} className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 truncate">{record.worker_name}</h4>
                          <p className="text-sm text-gray-600 truncate">{record.site_name}</p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(record.status)}`}>
                          {getStatusIcon(record.status)} {record.status}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 mb-3">
                        <div className="text-center">
                          <p className="text-xs text-gray-500">Present</p>
                          <p className="text-sm font-medium text-green-600">{record.P}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-500">Absent</p>
                          <p className="text-sm font-medium text-red-600">{record.A}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-500">Half Day</p>
                          <p className="text-sm font-medium text-yellow-600">{record.HD}</p>
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center text-xs text-gray-500">
                        <span>Submitted: {formatTime(record.created_at)}</span>
                        {record.approved_at && (
                          <span>Approved: {formatTime(record.approved_at)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ForemanAttendanceHistory;
