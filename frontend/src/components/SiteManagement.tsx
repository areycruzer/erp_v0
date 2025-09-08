import React, { useState, useEffect } from 'react';
import LoadingSpinner from './LoadingSpinner';

interface Site {
  id: string;
  name: string;
  address: string;
  site_incharge_id?: string;
  site_incharge_name?: string;
  foremen_ids: string[];
  foremen_names: string[];
  status: 'ACTIVE' | 'INACTIVE' | 'UNDER_CONSTRUCTION' | 'COMPLETED';
  created_at: string;
  updated_at: string;
  total_workers: number;
  description?: string;
  phone?: string;
}

interface CreateSiteForm {
  name: string;
  address: string;
  description: string;
  phone: string;
  site_incharge_id: string;
  status: 'ACTIVE' | 'INACTIVE' | 'UNDER_CONSTRUCTION' | 'COMPLETED';
}

const SiteManagement: React.FC = () => {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [createForm, setCreateForm] = useState<CreateSiteForm>({
    name: '',
    address: '',
    description: '',
    phone: '',
    site_incharge_id: '',
    status: 'UNDER_CONSTRUCTION'
  });

  useEffect(() => {
    loadSites();
  }, []);

  const loadSites = async () => {
    try {
      setLoading(true);
      // Mock sites data - in production this would come from an API
      const mockSites: Site[] = [
        {
          id: 'site1',
          name: 'Downtown Commercial Complex',
          address: '123 Main Street, Downtown, Mumbai',
          site_incharge_id: '2',
          site_incharge_name: 'Site Incharge Mary',
          foremen_ids: ['3'],
          foremen_names: ['Foreman John'],
          status: 'ACTIVE',
          created_at: '2024-01-10T08:00:00Z',
          updated_at: '2024-01-10T08:00:00Z',
          total_workers: 45,
          description: 'Large commercial complex construction project',
          phone: '+91-9876501234'
        },
        {
          id: 'site2',
          name: 'Residential Tower Phase 1',
          address: '456 Park Avenue, Bandra, Mumbai',
          site_incharge_id: '2',
          site_incharge_name: 'Site Incharge Mary',
          foremen_ids: [],
          foremen_names: [],
          status: 'UNDER_CONSTRUCTION',
          created_at: '2024-02-01T09:00:00Z',
          updated_at: '2024-02-01T09:00:00Z',
          total_workers: 32,
          description: 'High-rise residential tower construction',
          phone: '+91-9876501235'
        },
        {
          id: 'site3',
          name: 'Office Building Renovation',
          address: '789 Business District, Andheri, Mumbai',
          site_incharge_id: '4',
          site_incharge_name: 'Site Incharge Sarah',
          foremen_ids: [],
          foremen_names: [],
          status: 'INACTIVE',
          created_at: '2024-01-20T10:00:00Z',
          updated_at: '2024-01-20T10:00:00Z',
          total_workers: 18,
          description: 'Complete office building renovation project'
        },
        {
          id: 'site4',
          name: 'Shopping Mall Phase 2',
          address: '321 Commerce Street, Powai, Mumbai',
          status: 'COMPLETED',
          foremen_ids: [],
          foremen_names: [],
          created_at: '2023-12-01T07:00:00Z',
          updated_at: '2024-01-15T17:00:00Z',
          total_workers: 0,
          description: 'Shopping mall construction - Phase 2 completed'
        }
      ];
      
      setSites(mockSites);
    } catch (err) {
      setError('Failed to load sites');
      console.error('Error loading sites:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSite = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setError(null);
      
      // Mock site creation - in production this would call an API
      const newSite: Site = {
        id: `site_${Date.now()}`,
        name: createForm.name,
        address: createForm.address,
        description: createForm.description,
        phone: createForm.phone,
        site_incharge_id: createForm.site_incharge_id,
        site_incharge_name: createForm.site_incharge_id ? 'Selected Incharge' : undefined,
        foremen_ids: [],
        foremen_names: [],
        status: createForm.status,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        total_workers: 0
      };

      setSites(prev => [newSite, ...prev]);
      setSuccess(`Site "${createForm.name}" created successfully!`);
      setShowCreateForm(false);
      setCreateForm({
        name: '',
        address: '',
        description: '',
        phone: '',
        site_incharge_id: '',
        status: 'UNDER_CONSTRUCTION'
      });

      setTimeout(() => setSuccess(null), 3000);
      
    } catch (err) {
      setError('Failed to create site');
      console.error('Error creating site:', err);
    }
  };

  const handleToggleSiteStatus = async (siteId: string) => {
    try {
      setError(null);
      
      // Mock status toggle - in production this would call an API
      setSites(prev => prev.map(site => {
        if (site.id === siteId) {
          const newStatus = site.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
          return { ...site, status: newStatus, updated_at: new Date().toISOString() };
        }
        return site;
      }));
      
      const site = sites.find(s => s.id === siteId);
      const newStatus = site?.status === 'ACTIVE' ? 'inactive' : 'active';
      setSuccess(`Site ${newStatus} successfully!`);
      setTimeout(() => setSuccess(null), 3000);
      
    } catch (err) {
      setError('Failed to update site status');
      console.error('Error updating site status:', err);
    }
  };

  const handleDeleteSite = async (siteId: string) => {
    if (!window.confirm('Are you sure you want to delete this site? This will also remove all associated data.')) {
      return;
    }

    try {
      setError(null);
      
      // Mock site deletion - in production this would call an API
      setSites(prev => prev.filter(site => site.id !== siteId));
      setSuccess('Site deleted successfully!');
      setTimeout(() => setSuccess(null), 3000);
      
    } catch (err) {
      setError('Failed to delete site');
      console.error('Error deleting site:', err);
    }
  };

  const filteredSites = sites.filter(site => {
    const matchesSearch = site.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         site.address.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || site.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800';
      case 'INACTIVE':
        return 'bg-red-100 text-red-800';
      case 'UNDER_CONSTRUCTION':
        return 'bg-yellow-100 text-yellow-800';
      case 'COMPLETED':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return '✅';
      case 'INACTIVE':
        return '❌';
      case 'UNDER_CONSTRUCTION':
        return '🚧';
      case 'COMPLETED':
        return '🏁';
      default:
        return '❓';
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
          <p className="mt-4 text-gray-600">Loading sites...</p>
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
              <h1 className="text-2xl font-bold text-gray-900">🏗️ Site Management</h1>
              <p className="text-gray-600">Manage construction sites and assignments</p>
            </div>
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center"
            >
              ➕ Add Site
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 lg:p-6">
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

        {/* Filters */}
        <div className="bg-white rounded-lg p-4 shadow-sm border mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search Sites</label>
              <input
                type="text"
                placeholder="🔍 Search by name or address..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="UNDER_CONSTRUCTION">Under Construction</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>
          </div>
        </div>

        {/* Sites Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredSites.map((site) => (
            <div key={site.id} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
              <div className="p-6">
                {/* Site Header */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{site.name}</h3>
                    <div className="flex items-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(site.status)}`}>
                        {getStatusIcon(site.status)} {site.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Site Details */}
                <div className="space-y-3 mb-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700">📍 Address</p>
                    <p className="text-sm text-gray-600">{site.address}</p>
                  </div>

                  {site.description && (
                    <div>
                      <p className="text-sm font-medium text-gray-700">📝 Description</p>
                      <p className="text-sm text-gray-600">{site.description}</p>
                    </div>
                  )}

                  {site.phone && (
                    <div>
                      <p className="text-sm font-medium text-gray-700">📞 Phone</p>
                      <p className="text-sm text-gray-600">{site.phone}</p>
                    </div>
                  )}

                  <div>
                    <p className="text-sm font-medium text-gray-700">👨‍💼 Site Incharge</p>
                    <p className="text-sm text-gray-600">{site.site_incharge_name || 'Not assigned'}</p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-700">👷‍♂️ Foremen</p>
                    <p className="text-sm text-gray-600">
                      {site.foremen_names.length > 0 ? site.foremen_names.join(', ') : 'No foremen assigned'}
                    </p>
                  </div>

                  <div className="flex justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">👥 Workers</p>
                      <p className="text-sm text-gray-600">{site.total_workers}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-700">📅 Created</p>
                      <p className="text-sm text-gray-600">{formatDate(site.created_at)}</p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                  <div className="flex space-x-2">
                    <button className="text-blue-600 hover:text-blue-800 text-sm">
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => handleToggleSiteStatus(site.id)}
                      className={`text-sm ${
                        site.status === 'ACTIVE'
                          ? 'text-red-600 hover:text-red-800'
                          : 'text-green-600 hover:text-green-800'
                      }`}
                    >
                      {site.status === 'ACTIVE' ? '🚫 Deactivate' : '✅ Activate'}
                    </button>
                  </div>
                  <button
                    onClick={() => handleDeleteSite(site.id)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredSites.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
            <div className="text-4xl mb-4">🏗️</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Sites Found</h3>
            <p className="text-gray-500">
              {searchTerm || statusFilter !== 'all' 
                ? 'No sites match your current filters.'
                : 'No sites have been created yet.'}
            </p>
          </div>
        )}
      </div>

      {/* Create Site Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">🏗️ Create New Site</h3>
              
              <form onSubmit={handleCreateSite} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Site Name *</label>
                  <input
                    type="text"
                    required
                    value={createForm.name}
                    onChange={(e) => setCreateForm({...createForm, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
                  <textarea
                    required
                    rows={3}
                    value={createForm.address}
                    onChange={(e) => setCreateForm({...createForm, address: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    rows={2}
                    value={createForm.description}
                    onChange={(e) => setCreateForm({...createForm, description: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm({...createForm, phone: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status *</label>
                  <select
                    required
                    value={createForm.status}
                    onChange={(e) => setCreateForm({...createForm, status: e.target.value as any})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="UNDER_CONSTRUCTION">Under Construction</option>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="COMPLETED">Completed</option>
                  </select>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false);
                      setCreateForm({
                        name: '',
                        address: '',
                        description: '',
                        phone: '',
                        site_incharge_id: '',
                        status: 'UNDER_CONSTRUCTION'
                      });
                    }}
                    className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Create Site
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SiteManagement;
