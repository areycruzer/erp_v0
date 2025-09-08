import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { workersApi, attendanceApi, sitesApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { pwaManager } from '../lib/pwa';
import LoadingSpinner from './LoadingSpinner';

const attendanceSchema = z.object({
  siteId: z.string().min(1, 'Please select a site'),
  date: z.string().min(1, 'Date is required'),
  workers: z.array(z.string()).min(1, 'Please select at least one worker'),
  P: z.number().min(0, 'P value must be 0 or greater'),
  A: z.number().min(0, 'A value must be 0 or greater'),
  HD: z.number().min(0, 'HD value must be 0 or greater'),
  interpretationMode: z.enum(['TOTAL_COUNT', 'P_ONLY'])
});

type AttendanceFormData = z.infer<typeof attendanceSchema>;

interface Worker {
  id: string;
  name: string;
  father_name: string;
  adhar_number_encrypted?: string;
  phone_number?: string;
  site_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Site {
  id: string;
  name: string;
  location?: string;
  notes?: string;
  full_day_hours: number;
  interpretation_mode: 'HOURS' | 'HALF_DAYS';
  checkpoint_time: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}

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

const ForemanMobileInterface: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'submit' | 'history'>('submit');
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [selectedWorkers, setSelectedWorkers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors }
  } = useForm<AttendanceFormData>({
    resolver: zodResolver(attendanceSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      workers: [],
      P: 0,
      A: 0,
      HD: 0,
      interpretationMode: 'TOTAL_COUNT'
    }
  });

  const selectedSiteId = watch('siteId');
  const selectedSite = sites.find(site => site.id === selectedSiteId);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      loadAttendanceHistory();
    }
  }, [activeTab]);

  useEffect(() => {
    if (selectedSite) {
      setValue('P', selectedSite.full_day_hours);
      setValue('interpretationMode', selectedSite.interpretation_mode === 'HOURS' ? 'TOTAL_COUNT' : 'P_ONLY');
    }
  }, [selectedSite, setValue]);

  useEffect(() => {
    setValue('workers', Array.from(selectedWorkers));
  }, [selectedWorkers, setValue]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [workersResponse, sitesResponse] = await Promise.all([
        workersApi.getAll(),
        sitesApi.getAll()
      ]);
      
      setWorkers(workersResponse.workers.filter((worker: Worker) => worker.is_active));
      setSites(sitesResponse);
    } catch (err) {
      setError('Failed to load data. Please try again.');
      console.error('Error loading initial data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAttendanceHistory = async () => {
    try {
      const response = await attendanceApi.getAll({
        limit: 50,
        offset: 0
      });
      // Transform the response to match our interface
      const transformedHistory = (response.attendance || []).map((record: any) => ({
        ...record,
        worker_name: record.worker_name || 'Unknown Worker',
        site_name: record.site_name || 'Unknown Site'
      }));
      setAttendanceHistory(transformedHistory);
    } catch (err) {
      console.error('Error loading attendance history:', err);
    }
  };

  const filteredWorkers = workers.filter(worker => 
    worker.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    worker.father_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleWorkerToggle = (workerId: string) => {
    const newSelected = new Set(selectedWorkers);
    if (newSelected.has(workerId)) {
      newSelected.delete(workerId);
    } else {
      newSelected.add(workerId);
    }
    setSelectedWorkers(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedWorkers.size === filteredWorkers.length) {
      setSelectedWorkers(new Set());
    } else {
      setSelectedWorkers(new Set(filteredWorkers.map(worker => worker.id)));
    }
  };

  const onSubmit = async (data: AttendanceFormData) => {
    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);

      // Check if we're online
      const isOnline = navigator.onLine;
      
      if (!isOnline) {
        // Store attendance offline
        const offlineAttendance = {
          site_id: data.siteId,
          foreman_id: user?.id || '',
          date: data.date,
          workers: data.workers.map(workerId => ({
            worker_id: workerId,
            status: 'PRESENT' as const,
            hours_worked: data.P,
            notes: `P:${data.P}, A:${data.A}, HD:${data.HD}, Mode:${data.interpretationMode}`
          })),
          timestamp: new Date().toISOString(),
          synced: false
        };

        await pwaManager.storeOfflineAttendance(offlineAttendance);
        setSuccess(`📱 Attendance stored offline for ${data.workers.length} workers. Will sync when online.`);
        setSelectedWorkers(new Set());
        setValue('workers', []);
        
        // Auto-clear success message after 5 seconds
        setTimeout(() => setSuccess(null), 5000);
        return;
      }

      // Online submission - original logic
      const attendancePromises = data.workers.map(workerId => 
        attendanceApi.create({
          workerId,
          siteId: data.siteId,
          date: data.date,
          P: data.P,
          A: data.A,
          HD: data.HD,
          interpretationMode: data.interpretationMode,
          submittedBy: user?.id || '',
          status: 'PENDING'
        })
      );

      await Promise.all(attendancePromises);
      
      setSuccess(`✅ Attendance submitted for ${data.workers.length} workers successfully!`);
      setSelectedWorkers(new Set());
      setValue('workers', []);
      
      // Auto-clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
      
    } catch (err) {
      // If online submission fails, try storing offline as fallback
      if (navigator.onLine) {
        try {
          const offlineAttendance = {
            site_id: data.siteId,
            foreman_id: user?.id || '',
            date: data.date,
            workers: data.workers.map(workerId => ({
              worker_id: workerId,
              status: 'PRESENT' as const,
              hours_worked: data.P,
              notes: `P:${data.P}, A:${data.A}, HD:${data.HD}, Mode:${data.interpretationMode}`
            })),
            timestamp: new Date().toISOString(),
            synced: false
          };

          await pwaManager.storeOfflineAttendance(offlineAttendance);
          setSuccess(`📱 Network error: Attendance stored offline for ${data.workers.length} workers. Will sync when connection improves.`);
          setSelectedWorkers(new Set());
          setValue('workers', []);
          
          setTimeout(() => setSuccess(null), 5000);
        } catch (offlineErr) {
          setError('Failed to submit attendance. Please try again.');
          console.error('Error submitting attendance:', err);
        }
      } else {
        setError('Failed to submit attendance. Please try again.');
        console.error('Error submitting attendance:', err);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner />
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="px-4 py-3">
          <h1 className="text-lg font-semibold text-gray-900">Foreman Dashboard</h1>
          <p className="text-sm text-gray-500">Welcome, {user?.name}</p>
        </div>
        
        {/* Tab Navigation */}
        <div className="px-4 pb-3">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('submit')}
              className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'submit'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600'
              }`}
            >
              📝 Submit
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'history'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600'
              }`}
            >
              📊 History
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="pb-20"> {/* Bottom padding for sticky submit button */}
        {activeTab === 'submit' && (
          <div className="p-4 space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-600 text-sm">❌ {error}</p>
              </div>
            )}
            
            {success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-green-600 text-sm">{success}</p>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Site Selection */}
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  🏗️ Site *
                </label>
                <select
                  {...register('siteId')}
                  className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                >
                  <option value="">Select a site</option>
                  {sites.map(site => (
                    <option key={site.id} value={site.id}>
                      {site.name}
                    </option>
                  ))}
                </select>
                {errors.siteId && (
                  <p className="mt-1 text-sm text-red-600">{errors.siteId.message}</p>
                )}
              </div>

              {/* Date Selection */}
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📅 Date *
                </label>
                <input
                  type="date"
                  {...register('date')}
                  className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                />
                {errors.date && (
                  <p className="mt-1 text-sm text-red-600">{errors.date.message}</p>
                )}
              </div>

              {/* Attendance Values */}
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <h3 className="text-sm font-medium text-gray-700 mb-3">⏰ Attendance Values</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">P (Present)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      {...register('P', { valueAsNumber: true })}
                      className="w-full px-2 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-base"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">A (Absent)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      {...register('A', { valueAsNumber: true })}
                      className="w-full px-2 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-base"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">HD (Half Day)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      {...register('HD', { valueAsNumber: true })}
                      className="w-full px-2 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-base"
                    />
                  </div>
                </div>
              </div>

              {/* Worker Selection */}
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                  <label className="text-sm font-medium text-gray-700">
                    👷 Workers ({selectedWorkers.size} selected)
                  </label>
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium touch-manipulation"
                  >
                    {selectedWorkers.size === filteredWorkers.length ? '❌ Deselect All' : '✅ Select All'}
                  </button>
                </div>

                {/* Search */}
                <div className="mb-3">
                  <input
                    type="text"
                    placeholder="🔍 Search workers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                  />
                </div>
                
                <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                  {filteredWorkers.map((worker, index) => (
                    <label
                      key={worker.id}
                      className={`flex items-center p-3 cursor-pointer touch-manipulation active:bg-blue-50 ${
                        index !== filteredWorkers.length - 1 ? 'border-b border-gray-200' : ''
                      } ${selectedWorkers.has(worker.id) ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedWorkers.has(worker.id)}
                        onChange={() => handleWorkerToggle(worker.id)}
                        className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <div className="ml-3 flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{worker.name}</p>
                        <p className="text-xs text-gray-500 truncate">Father: {worker.father_name}</p>
                        {worker.phone_number && (
                          <p className="text-xs text-blue-600">📞 {worker.phone_number}</p>
                        )}
                      </div>
                      {selectedWorkers.has(worker.id) && (
                        <div className="ml-2 text-blue-600">
                          ✓
                        </div>
                      )}
                    </label>
                  ))}
                </div>
                
                {errors.workers && (
                  <p className="mt-2 text-sm text-red-600">{errors.workers.message}</p>
                )}
              </div>
            </form>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="p-4">
            <div className="space-y-3">
              {attendanceHistory.length === 0 ? (
                <div className="bg-white rounded-lg p-8 text-center shadow-sm">
                  <div className="text-4xl mb-4">📋</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Attendance Records</h3>
                  <p className="text-gray-500">You haven't submitted any attendance records yet.</p>
                </div>
              ) : (
                attendanceHistory.map((record) => (
                  <div key={record.id} className="bg-white rounded-lg p-4 shadow-sm border">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-medium text-gray-900">{record.worker_name}</h3>
                        <p className="text-sm text-gray-600">{record.site_name}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(record.status)}`}>
                        {record.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 mb-2">
                      <div className="text-center">
                        <p className="text-xs text-gray-500">Date</p>
                        <p className="text-sm font-medium">{formatDate(record.date)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500">P</p>
                        <p className="text-sm font-medium text-green-600">{record.P}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500">A</p>
                        <p className="text-sm font-medium text-red-600">{record.A}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500">HD</p>
                        <p className="text-sm font-medium text-yellow-600">{record.HD}</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">
                      Submitted: {formatDate(record.created_at)}
                      {record.approved_at && ` • Approved: ${formatDate(record.approved_at)}`}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sticky Submit Button - Only show on submit tab */}
      {activeTab === 'submit' && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg">
          <button
            type="submit"
            onClick={handleSubmit(onSubmit)}
            disabled={submitting || selectedWorkers.size === 0}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center font-medium text-base touch-manipulation"
          >
            {submitting ? (
              <>
                <LoadingSpinner size="sm" />
                <span className="ml-2">Submitting...</span>
              </>
            ) : (
              `📤 Submit for ${selectedWorkers.size} Worker${selectedWorkers.size === 1 ? '' : 's'}`
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default ForemanMobileInterface;
