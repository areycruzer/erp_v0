import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { attendanceApi, workersApi, sitesApi } from '../lib/api';
import LoadingSpinner from './LoadingSpinner';

interface AttendanceRecord {
  id: string;
  worker_id: string;
  site_id: string;
  date: string;
  P: number;
  A: number;
  HD: number;
  interpretation_mode: 'TOTAL_COUNT' | 'P_ONLY';
  submitted_by: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
  worker?: {
    id: string;
    name: string;
    father_name: string;
  };
  site?: {
    id: string;
    name: string;
    location?: string;
  };
}

const AttendanceReview: React.FC = () => {
  const { user } = useAuth();
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalRecord, setModalRecord] = useState<AttendanceRecord | null>(null);
  const [modalValues, setModalValues] = useState<{ P: number; A: number; HD: number; interpretation_mode: 'TOTAL_COUNT' | 'P_ONLY' }>({ P: 0, A: 0, HD: 0, interpretation_mode: 'TOTAL_COUNT' });
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    loadAttendanceRecords();
  }, [filter]);

  const loadAttendanceRecords = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params: any = {};
      if (filter !== 'all') {
        params.status = filter.toUpperCase();
      }

      const response = await attendanceApi.getAll(params);
      
      // Enrich attendance records with worker and site details
      const enrichedRecords = await Promise.all(
        response.attendance.map(async (record) => {
          try {
            const [workerResponse, siteResponse] = await Promise.all([
              workersApi.getById(record.worker_id),
              sitesApi.getById(record.site_id)
            ]);
            
            return {
              ...record,
              worker: {
                id: workerResponse.id,
                name: workerResponse.name,
                father_name: workerResponse.father_name
              },
              site: {
                id: siteResponse.id,
                name: siteResponse.name,
                location: siteResponse.location
              }
            };
          } catch (err) {
            console.error(`Error enriching record ${record.id}:`, err);
            return record;
          }
        })
      );

      setAttendanceRecords(enrichedRecords);
    } catch (err) {
      setError('Failed to load attendance records. Please try again.');
      console.error('Error loading attendance records:', err);
    } finally {
      setLoading(false);
    }
  };

  // Open modal for editing before approval
  const openApproveModal = (record: AttendanceRecord) => {
    setModalRecord(record);
    setModalValues({
      P: record.P,
      A: record.A,
      HD: record.HD,
      interpretation_mode: record.interpretation_mode
    });
    setModalError(null);
    setModalOpen(true);
  };

  // Handle modal value changes
  const handleModalChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setModalValues((prev) => ({
      ...prev,
      [name]: name === 'interpretation_mode' ? value : Number(value)
    }));
  };

  // Confirm approval with edited values
  const handleModalApprove = async () => {
    if (!modalRecord) return;
    try {
      setProcessing(modalRecord.id);
      setModalError(null);
      // Update attendance record first
      await attendanceApi.update(modalRecord.id, {
        P: modalValues.P,
        A: modalValues.A,
        HD: modalValues.HD,
        interpretationMode: modalValues.interpretation_mode
      });
      // Approve after update
      await attendanceApi.approve(modalRecord.id);
      setAttendanceRecords(prev =>
        prev.map(record =>
          record.id === modalRecord.id
            ? {
                ...record,
                P: modalValues.P,
                A: modalValues.A,
                HD: modalValues.HD,
                interpretation_mode: modalValues.interpretation_mode,
                status: 'APPROVED' as const,
                approved_by: user?.id,
                approved_at: new Date().toISOString()
              }
            : record
        )
      );
      setSuccess('Attendance record approved successfully!');
      setTimeout(() => setSuccess(null), 3000);
      setModalOpen(false);
      setModalRecord(null);
    } catch (err) {
      setModalError('Failed to approve attendance record. Please try again.');
      console.error('Error approving attendance:', err);
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (recordId: string) => {
    try {
      setProcessing(recordId);
      setError(null);
      
      await attendanceApi.reject(recordId);
      
      // Update the record in the local state
      setAttendanceRecords(prev => 
        prev.map(record => 
          record.id === recordId 
            ? { ...record, status: 'REJECTED' as const, approved_by: user?.id, approved_at: new Date().toISOString() }
            : record
        )
      );
      
      setSuccess('Attendance record rejected successfully!');
      setTimeout(() => setSuccess(null), 3000);
      
    } catch (err) {
      setError('Failed to reject attendance record. Please try again.');
      console.error('Error rejecting attendance:', err);
    } finally {
      setProcessing(null);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-green-100 text-green-800';
      case 'REJECTED':
        return 'bg-red-100 text-red-800';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredRecords = attendanceRecords.filter(record => {
    if (filter === 'all') return true;
    return record.status === filter.toUpperCase();
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 sm:mb-0">Attendance Review</h2>
          
          {/* Filter Tabs */}
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
            {(['all', 'pending', 'approved', 'rejected'] as const).map((filterOption) => (
              <button
                key={filterOption}
                onClick={() => setFilter(filterOption)}
                className={`px-3 py-1 rounded-md text-sm font-medium capitalize transition-colors ${
                  filter === filterOption
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {filterOption}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
            <p className="text-green-600">{success}</p>
          </div>
        )}

        {filteredRecords.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500">
              <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No attendance records</h3>
              <p className="mt-1 text-sm text-gray-500">
                No attendance records found for the selected filter.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Worker
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Site
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Attendance
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {record.worker?.name || 'Unknown Worker'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {record.worker?.father_name && `S/o ${record.worker.father_name}`}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {record.site?.name || 'Unknown Site'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {record.site?.location || 'No location'}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(record.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          P: {record.P}, A: {record.A}, HD: {record.HD}
                        </div>
                        <div className="text-xs text-gray-500">
                          Mode: {record.interpretation_mode}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(record.status)}`}>
                          {record.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {record.status === 'PENDING' && (user?.role === 'ADMIN' || user?.role === 'SITE_INCHARGE') && (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => openApproveModal(record)}
                              disabled={processing === record.id}
                              className="text-green-600 hover:text-green-900 disabled:text-gray-400 disabled:cursor-not-allowed"
                            >
                              {processing === record.id ? (
                                <LoadingSpinner size="sm" />
                              ) : (
                                'Approve'
                              )}
                            </button>
                            <button
                              onClick={() => handleReject(record.id)}
                              disabled={processing === record.id}
                              className="text-red-600 hover:text-red-900 disabled:text-gray-400 disabled:cursor-not-allowed"
                            >
                              {processing === record.id ? (
                                <LoadingSpinner size="sm" />
                              ) : (
                                'Reject'
                              )}
                            </button>
                          </div>
                        )}
      {/* Approval Modal */}
      {modalOpen && modalRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md relative">
            <h3 className="text-lg font-bold mb-4">Edit & Approve Attendance</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Worker</label>
                <div className="text-gray-900 font-semibold">{modalRecord.worker?.name}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Site</label>
                <div className="text-gray-900">{modalRecord.site?.name}</div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700">P</label>
                  <input type="number" name="P" min={0} step={0.1} value={modalValues.P} onChange={handleModalChange} className="w-full border rounded px-2 py-1" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">A</label>
                  <input type="number" name="A" min={0} step={0.1} value={modalValues.A} onChange={handleModalChange} className="w-full border rounded px-2 py-1" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">HD</label>
                  <input type="number" name="HD" min={0} step={0.1} value={modalValues.HD} onChange={handleModalChange} className="w-full border rounded px-2 py-1" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Interpretation Mode</label>
                <select name="interpretation_mode" value={modalValues.interpretation_mode} onChange={handleModalChange} className="w-full border rounded px-2 py-1">
                  <option value="TOTAL_COUNT">Total Count</option>
                  <option value="P_ONLY">P Only</option>
                </select>
              </div>
              <div className="text-xs text-gray-500 mt-2">
                <span className="font-semibold">Total:</span> {modalValues.P + modalValues.A + modalValues.HD}
              </div>
              {modalError && <div className="text-red-600 text-sm">{modalError}</div>}
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <button onClick={() => { setModalOpen(false); setModalRecord(null); }} className="px-4 py-2 rounded bg-gray-200 text-gray-700 hover:bg-gray-300">Cancel</button>
              <button onClick={handleModalApprove} disabled={processing === modalRecord.id} className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400">
                {processing === modalRecord.id ? <LoadingSpinner size="sm" /> : 'Approve'}
              </button>
            </div>
          </div>
        </div>
      )}
                        {record.status !== 'PENDING' && (
                          <span className="text-gray-500">
                            {record.approved_at && `on ${new Date(record.approved_at).toLocaleDateString()}`}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendanceReview;
