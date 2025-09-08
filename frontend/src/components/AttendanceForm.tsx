import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { workersApi, attendanceApi, sitesApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
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

const AttendanceForm: React.FC = () => {
  const { user } = useAuth();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedWorkers, setSelectedWorkers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
    if (selectedWorkers.size === workers.length) {
      setSelectedWorkers(new Set());
    } else {
      setSelectedWorkers(new Set(workers.map(worker => worker.id)));
    }
  };

  const onSubmit = async (data: AttendanceFormData) => {
    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);

      // Create attendance records for each selected worker
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
      
      setSuccess(`Attendance submitted for ${data.workers.length} workers successfully!`);
      setSelectedWorkers(new Set());
      setValue('workers', []);
      
      // Auto-clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
      
    } catch (err) {
      setError('Failed to submit attendance. Please try again.');
      console.error('Error submitting attendance:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Submit Attendance</h2>
        
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

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Site Selection */}
          <div>
            <label htmlFor="siteId" className="block text-sm font-medium text-gray-700 mb-2">
              Site *
            </label>
            <select
              {...register('siteId')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a site</option>
              {sites.map(site => (
                <option key={site.id} value={site.id}>
                  {site.name} - {site.location || 'No location'}
                </option>
              ))}
            </select>
            {errors.siteId && (
              <p className="mt-1 text-sm text-red-600">{errors.siteId.message}</p>
            )}
          </div>

          {/* Date Selection */}
          <div>
            <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">
              Date *
            </label>
            <input
              type="date"
              {...register('date')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.date && (
              <p className="mt-1 text-sm text-red-600">{errors.date.message}</p>
            )}
          </div>

          {/* Attendance Values */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="P" className="block text-sm font-medium text-gray-700 mb-2">
                P (Present)
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                {...register('P', { valueAsNumber: true })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.P && (
                <p className="mt-1 text-sm text-red-600">{errors.P.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="A" className="block text-sm font-medium text-gray-700 mb-2">
                A (Absent)
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                {...register('A', { valueAsNumber: true })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.A && (
                <p className="mt-1 text-sm text-red-600">{errors.A.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="HD" className="block text-sm font-medium text-gray-700 mb-2">
                HD (Half Day)
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                {...register('HD', { valueAsNumber: true })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.HD && (
                <p className="mt-1 text-sm text-red-600">{errors.HD.message}</p>
              )}
            </div>
          </div>

          {/* Interpretation Mode */}
          <div>
            <label htmlFor="interpretationMode" className="block text-sm font-medium text-gray-700 mb-2">
              Interpretation Mode
            </label>
            <select
              {...register('interpretationMode')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="TOTAL_COUNT">Total Count</option>
              <option value="P_ONLY">P Only</option>
            </select>
          </div>

          {/* Worker Selection */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <label className="block text-sm font-medium text-gray-700">
                Select Workers * ({selectedWorkers.size} selected)
              </label>
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                {selectedWorkers.size === workers.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            
            <div className="max-h-64 overflow-y-auto border border-gray-300 rounded-md p-4 space-y-2">
              {workers.map(worker => (
                <label
                  key={worker.id}
                  className="flex items-center p-3 hover:bg-gray-50 rounded-md cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedWorkers.has(worker.id)}
                    onChange={() => handleWorkerToggle(worker.id)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <div className="ml-3 flex-1">
                    <p className="text-sm font-medium text-gray-900">{worker.name}</p>
                    <p className="text-xs text-gray-500">
                      Adhaar: {worker.adhar_number_encrypted ? worker.adhar_number_encrypted.replace(/\d(?=\d{4})/g, '*') : 'N/A'}
                    </p>
                  </div>
                </label>
              ))}
            </div>
            
            {errors.workers && (
              <p className="mt-1 text-sm text-red-600">{errors.workers.message}</p>
            )}
          </div>

          {/* Submit Button - Sticky on mobile */}
          <div className="sticky bottom-4 bg-white pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={submitting || selectedWorkers.size === 0}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {submitting ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span className="ml-2">Submitting...</span>
                </>
              ) : (
                `Submit Attendance for ${selectedWorkers.size} Worker${selectedWorkers.size === 1 ? '' : 's'}`
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AttendanceForm;
