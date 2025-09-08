import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import AttendanceForm from './AttendanceForm';
import AttendanceReview from './AttendanceReview';

const AttendanceManager: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'submit' | 'review'>('submit');

  const tabs = [
    { id: 'submit', name: 'Submit Attendance', allowed: ['ADMIN', 'FOREMAN'] },
    { id: 'review', name: 'Review Attendance', allowed: ['ADMIN', 'SITE_INCHARGE'] }
  ];

  const availableTabs = tabs.filter(tab => 
    tab.allowed.includes(user?.role || '')
  );

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      {/* Tab Navigation */}
      {availableTabs.length > 1 && (
        <div className="bg-white rounded-lg shadow-sm border p-1">
          <nav className="flex space-x-1" aria-label="Tabs">
            {availableTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as 'submit' | 'review')}
                className={`flex-1 py-2 px-4 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {tab.name}
              </button>
            ))}
          </nav>
        </div>
      )}

      {/* Tab Content */}
      <div>
        {activeTab === 'submit' && availableTabs.some(tab => tab.id === 'submit') && (
          <AttendanceForm />
        )}
        {activeTab === 'review' && availableTabs.some(tab => tab.id === 'review') && (
          <AttendanceReview />
        )}
      </div>

      {/* If user only has access to one tab, show it directly */}
      {availableTabs.length === 1 && (
        <div>
          {availableTabs[0].id === 'submit' && <AttendanceForm />}
          {availableTabs[0].id === 'review' && <AttendanceReview />}
        </div>
      )}

      {/* If user has no access */}
      {availableTabs.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="text-center py-12">
            <div className="text-gray-500">
              <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">Access Restricted</h3>
              <p className="mt-1 text-sm text-gray-500">
                You don't have permission to access attendance management features.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceManager;
