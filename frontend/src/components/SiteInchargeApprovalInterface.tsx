import React, { useState, useEffect } from 'react';
import { attendanceApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from './LoadingSpinner';

interface PendingAttendance {
  id: string;
  worker_id: string;
  worker_name: string;
  worker_father_name: string;
  site_id: string;
  site_name: string;
  date: string;
  P: number;
  A: number;
  HD: number;
  interpretation_mode: string;
  status: 'PENDING';
  submitted_by: number;
  submitter_name: string;
  created_at: string;
  total_hours?: number;
}

interface EditingRecord {
  id: string;
  P: number;
  A: number;
  HD: number;
}

const SiteInchargeApprovalInterface: React.FC = () => {
  const { user } = useAuth();
  console.log('Current user:', user); // Use the user variable to avoid TS error
  const [pendingRecords, setPendingRecords] = useState<PendingAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<EditingRecord | null>(null);
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());
  const [filterSite, setFilterSite] = useState<string>('all');
  const [filterDate, setFilterDate] = useState<string>('');
  const [sortBy, setSortBy] = useState<'date' | 'worker' | 'site' | 'submitter'>('date');

  useEffect(() => {
    loadPendingApprovals();
    const interval = setInterval(loadPendingApprovals, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadPendingApprovals = async () => {
    try {
      setLoading(true);
      // For site incharge, we need to get records for their assigned sites
      const response = await attendanceApi.getAll({ status: 'PENDING', limit: 100 });
      
      // Transform the response to match our interface
      const transformedRecords = (response.attendance || []).map((record: any) => ({
        ...record,
        worker_name: record.worker_name || 'Unknown Worker',
        worker_father_name: record.worker_father_name || '',
        site_name: record.site_name || 'Unknown Site',
        submitter_name: record.submitter_name || 'Unknown Submitter',
        total_hours: record.P + (record.HD * 0.5) // Calculate total hours
      }));
      
      setPendingRecords(transformedRecords);
    } catch (err) {
      setError('Failed to load pending approvals');
      console.error('Error loading pending approvals:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (recordId: string, updatedValues?: Partial<EditingRecord>) => {
    try {
      setProcessing(recordId);
      setError(null);

      if (updatedValues) {
        // Update the record first if values were modified
        await attendanceApi.update(recordId, {
          P: updatedValues.P,
          A: updatedValues.A,
          HD: updatedValues.HD
        });
      }

      await attendanceApi.approve(recordId);
      
      // Remove from pending list
      setPendingRecords(prev => prev.filter(record => record.id !== recordId));
      setSelectedRecords(prev => {
        const newSet = new Set(prev);
        newSet.delete(recordId);
        return newSet;
      });
      
      setSuccess('Attendance record approved successfully!');
      setTimeout(() => setSuccess(null), 3000);
      
    } catch (err) {
      setError('Failed to approve attendance record');
      console.error('Error approving attendance:', err);
    } finally {
      setProcessing(null);
      setEditingRecord(null);
    }
  };

  const handleReject = async (recordId: string) => {
    try {
      setProcessing(recordId);
      setError(null);
      
      await attendanceApi.reject(recordId);
      
      // Remove from pending list
      setPendingRecords(prev => prev.filter(record => record.id !== recordId));
      setSelectedRecords(prev => {
        const newSet = new Set(prev);
        newSet.delete(recordId);
        return newSet;
      });
      
      setSuccess('Attendance record rejected successfully!');
      setTimeout(() => setSuccess(null), 3000);
      
    } catch (err) {
      setError('Failed to reject attendance record');
      console.error('Error rejecting attendance:', err);
    } finally {
      setProcessing(null);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedRecords.size === 0) return;
    
    try {
      setProcessing('bulk');
      setError(null);
      
      const approvalPromises = Array.from(selectedRecords).map(recordId => 
        attendanceApi.approve(recordId)
      );
      
      await Promise.all(approvalPromises);
      
      // Remove approved records from pending list
      setPendingRecords(prev => prev.filter(record => !selectedRecords.has(record.id)));
      setSelectedRecords(new Set());
      
      setSuccess(`${selectedRecords.size} attendance records approved successfully!`);
      setTimeout(() => setSuccess(null), 3000);
      
    } catch (err) {
      setError('Failed to approve selected records');
      console.error('Error bulk approving:', err);
    } finally {
      setProcessing(null);
    }
  };

  const handleRecordSelect = (recordId: string) => {
    const newSelected = new Set(selectedRecords);
    if (newSelected.has(recordId)) {
      newSelected.delete(recordId);
    } else {
      newSelected.add(recordId);
    }
    setSelectedRecords(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedRecords.size === filteredRecords.length) {
      setSelectedRecords(new Set());
    } else {
      setSelectedRecords(new Set(filteredRecords.map(record => record.id)));
    }
  };

  const handleEditRecord = (record: PendingAttendance) => {
    setEditingRecord({
      id: record.id,
      P: record.P,
      A: record.A,
      HD: record.HD
    });
  };

  const handleSaveEdit = () => {
    if (editingRecord) {
      handleApprove(editingRecord.id, editingRecord);
    }
  };

  const filteredRecords = pendingRecords.filter(record => {
    if (filterSite !== 'all' && record.site_id !== filterSite) return false;
    if (filterDate && record.date !== filterDate) return false;
    return true;
  });

  const sortedRecords = [...filteredRecords].sort((a, b) => {
    switch (sortBy) {
      case 'date':
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      case 'worker':
        return a.worker_name.localeCompare(b.worker_name);
      case 'site':
        return a.site_name.localeCompare(b.site_name);
      case 'submitter':
        return a.submitter_name.localeCompare(b.submitter_name);
      default:
        return 0;
    }
  });

  const uniqueSites = Array.from(new Set(pendingRecords.map(record => record.site_id)))
    .map(siteId => {
      const record = pendingRecords.find(r => r.site_id === siteId);
      return { id: siteId, name: record?.site_name || 'Unknown Site' };
    });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner />
          <p className="mt-4 text-gray-600">Loading pending approvals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">
                ✅ Pending Approvals ({pendingRecords.length})
              </h1>
              <p className="text-sm text-gray-500">Review and approve attendance submissions</p>
            </div>
            {selectedRecords.size > 0 && (
              <button
                onClick={handleBulkApprove}
                disabled={processing === 'bulk'}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400 flex items-center text-sm"
              >
                {processing === 'bulk' ? (
                  <>
                    <LoadingSpinner size="sm" />
                    <span className="ml-2">Approving...</span>
                  </>
                ) : (
                  `✅ Approve ${selectedRecords.size} Selected`
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="p-4">
        {/* Status Messages */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-red-600 text-sm">❌ {error}</p>
          </div>
        )}
        
        {success && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-green-600 text-sm">✅ {success}</p>
          </div>
        )}

        {/* Filters and Controls */}
        <div className="bg-white rounded-lg p-4 shadow-sm border mb-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Filter by Site</label>
              <select
                value={filterSite}
                onChange={(e) => setFilterSite(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="all">All Sites</option>
                {uniqueSites.map(site => (
                  <option key={site.id} value={site.id}>{site.name}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Filter by Date</label>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Sort by</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="date">Date</option>
                <option value="worker">Worker Name</option>
                <option value="site">Site</option>
                <option value="submitter">Submitter</option>
              </select>
            </div>
            
            <div className="flex items-end">
              <button
                onClick={handleSelectAll}
                className="w-full px-3 py-2 text-sm text-blue-600 hover:text-blue-700 border border-blue-300 rounded-md hover:bg-blue-50"
              >
                {selectedRecords.size === filteredRecords.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
          </div>
        </div>

        {/* Pending Records */}
        <div className="space-y-3">
          {sortedRecords.length === 0 ? (
            <div className="bg-white rounded-lg p-8 text-center shadow-sm border">
              <div className="text-4xl mb-4">🎉</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Pending Approvals</h3>
              <p className="text-gray-500">All attendance submissions have been processed!</p>
            </div>
          ) : (
            sortedRecords.map((record) => (
              <div key={record.id} className="bg-white rounded-lg shadow-sm border overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedRecords.has(record.id)}
                        onChange={() => handleRecordSelect(record.id)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-3"
                      />
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-gray-900">{record.worker_name}</h3>
                        <p className="text-sm text-gray-600">Father: {record.worker_father_name}</p>
                        <p className="text-sm text-blue-600">{record.site_name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">{formatDate(record.date)}</p>
                      <p className="text-xs text-gray-500">by {record.submitter_name}</p>
                    </div>
                  </div>

                  {/* Attendance Values */}
                  {editingRecord?.id === record.id ? (
                    <div className="bg-blue-50 rounded-lg p-3 mb-3">
                      <h4 className="text-sm font-medium text-blue-900 mb-2">Edit Attendance Values</h4>
                      <div className="grid grid-cols-3 gap-3 mb-3">
                        <div>
                          <label className="block text-xs font-medium text-blue-700 mb-1">P (Present)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={editingRecord.P}
                            onChange={(e) => setEditingRecord({
                              ...editingRecord,
                              P: parseFloat(e.target.value) || 0
                            })}
                            className="w-full px-2 py-1 border border-blue-300 rounded text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-blue-700 mb-1">A (Absent)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={editingRecord.A}
                            onChange={(e) => setEditingRecord({
                              ...editingRecord,
                              A: parseFloat(e.target.value) || 0
                            })}
                            className="w-full px-2 py-1 border border-blue-300 rounded text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-blue-700 mb-1">HD (Half Day)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={editingRecord.HD}
                            onChange={(e) => setEditingRecord({
                              ...editingRecord,
                              HD: parseFloat(e.target.value) || 0
                            })}
                            className="w-full px-2 py-1 border border-blue-300 rounded text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => setEditingRecord(null)}
                          className="px-3 py-1 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveEdit}
                          disabled={processing === record.id}
                          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
                        >
                          Save & Approve
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-4 mb-3">
                      <div className="text-center">
                        <p className="text-xs text-gray-500">Present</p>
                        <p className="text-lg font-semibold text-green-600">{record.P}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500">Absent</p>
                        <p className="text-lg font-semibold text-red-600">{record.A}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500">Half Day</p>
                        <p className="text-lg font-semibold text-yellow-600">{record.HD}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500">Total Hours</p>
                        <p className="text-lg font-semibold text-blue-600">{record.total_hours?.toFixed(1)}</p>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  {editingRecord?.id !== record.id && (
                    <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                      <div className="text-xs text-gray-500">
                        Submitted: {formatDateTime(record.created_at)}
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEditRecord(record)}
                          className="px-3 py-1 text-sm text-blue-600 border border-blue-300 rounded hover:bg-blue-50"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => handleReject(record.id)}
                          disabled={processing === record.id}
                          className="px-3 py-1 text-sm text-red-600 border border-red-300 rounded hover:bg-red-50 disabled:bg-gray-100"
                        >
                          {processing === record.id ? 'Processing...' : '❌ Reject'}
                        </button>
                        <button
                          onClick={() => handleApprove(record.id)}
                          disabled={processing === record.id}
                          className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
                        >
                          {processing === record.id ? 'Processing...' : '✅ Approve'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default SiteInchargeApprovalInterface;
