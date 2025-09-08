import axios from 'axios';

// API configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3004';

// Create axios instance with default configuration
export const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid, redirect to login
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Types for API responses
export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'ADMIN' | 'SITE_INCHARGE' | 'FOREMAN';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Site {
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

export interface Worker {
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

export interface AttendanceRecord {
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
}

export interface CreateAttendanceRequest {
  workerId: string;
  siteId: string;
  date: string;
  P: number;
  A: number;
  HD: number;
  interpretationMode: 'TOTAL_COUNT' | 'P_ONLY';
  submittedBy: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  user: User;
  message: string;
}

export interface CreateUserRequest {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role: 'ADMIN' | 'SITE_INCHARGE' | 'FOREMAN';
  site_ids?: string[];
}

export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
}

// Auth API functions
export const authApi = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const { data } = await api.post('/auth/login', credentials);
    return data;
  },

  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
  },

  getCurrentUser: async (): Promise<User> => {
    const { data } = await api.get('/auth/me');
    return data.user;
  },
};

// Users API functions
export const usersApi = {
  getAll: async (params?: { 
    role?: string; 
    is_active?: boolean; 
    limit?: number; 
    offset?: number; 
  }): Promise<{ users: User[]; total: number }> => {
    const { data } = await api.get('/users', { params });
    return data;
  },

  getById: async (id: string): Promise<User> => {
    const { data } = await api.get(`/users/${id}`);
    return data.user;
  },

  create: async (userData: CreateUserRequest): Promise<User> => {
    const { data } = await api.post('/users', userData);
    return data.user;
  },

  update: async (id: string, userData: Partial<CreateUserRequest>): Promise<User> => {
    const { data } = await api.put(`/users/${id}`, userData);
    return data.user;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/users/${id}`);
  },

  assignSites: async (userId: string, siteIds: string[]): Promise<void> => {
    await api.post(`/users/${userId}/sites`, { site_ids: siteIds });
  },
};

// Sites API functions
export const sitesApi = {
  getAll: async (): Promise<Site[]> => {
    const { data } = await api.get('/sites');
    return data.sites;
  },

  getById: async (id: string): Promise<Site> => {
    const { data } = await api.get(`/sites/${id}`);
    return data.site;
  },

  create: async (siteData: Omit<Site, 'id' | 'created_at' | 'updated_at'>): Promise<Site> => {
    const { data } = await api.post('/sites', siteData);
    return data.site;
  },

  update: async (id: string, siteData: Partial<Omit<Site, 'id' | 'created_at' | 'updated_at'>>): Promise<Site> => {
    const { data } = await api.put(`/sites/${id}`, siteData);
    return data.site;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/sites/${id}`);
  },
};

// Workers API functions  
export const workersApi = {
  getAll: async (params?: {
    site_id?: string;
    is_active?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ workers: Worker[]; total: number }> => {
    const { data } = await api.get('/workers', { params });
    return data;
  },

  getById: async (id: string): Promise<Worker> => {
    const { data } = await api.get(`/workers/${id}`);
    return data.worker;
  },

  create: async (workerData: Omit<Worker, 'id' | 'created_at' | 'updated_at'>): Promise<Worker> => {
    const { data } = await api.post('/workers', workerData);
    return data.worker;
  },

  update: async (id: string, workerData: Partial<Omit<Worker, 'id' | 'created_at' | 'updated_at'>>): Promise<Worker> => {
    const { data } = await api.put(`/workers/${id}`, workerData);
    return data.worker;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/workers/${id}`);
  },
};

// Attendance API functions
export const attendanceApi = {
  getAll: async (params?: {
    site_id?: string;
    worker_id?: string;
    date?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ attendance: AttendanceRecord[]; total: number }> => {
    const { data } = await api.get('/attendance/v2', { params });
    return data;
  },

  getById: async (id: string): Promise<AttendanceRecord> => {
    const { data } = await api.get(`/attendance/v2/${id}`);
    return data.attendance;
  },

  create: async (attendanceData: CreateAttendanceRequest): Promise<AttendanceRecord> => {
    const { data } = await api.post('/attendance/v2', {
      worker_id: attendanceData.workerId,
      site_id: attendanceData.siteId,
      date: attendanceData.date,
      P: attendanceData.P,
      A: attendanceData.A,
      HD: attendanceData.HD,
      interpretation_mode: attendanceData.interpretationMode
    });
    return data.attendance;
  },

  update: async (id: string, attendanceData: Partial<CreateAttendanceRequest>): Promise<AttendanceRecord> => {
    const { data } = await api.put(`/attendance/v2/${id}`, {
      P: attendanceData.P,
      A: attendanceData.A,
      HD: attendanceData.HD,
      interpretation_mode: attendanceData.interpretationMode
    });
    return data.attendance;
  },

  approve: async (id: string): Promise<AttendanceRecord> => {
    const { data } = await api.put(`/attendance/v2/${id}/approve`);
    return data.attendance;
  },

  reject: async (id: string): Promise<AttendanceRecord> => {
    const { data } = await api.put(`/attendance/v2/${id}/reject`);
    return data.attendance;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/attendance/v2/${id}`);
  },

  getPendingApprovals: async (siteInchargeId?: string): Promise<{ attendance: AttendanceRecord[]; total: number }> => {
    const url = siteInchargeId 
      ? `/attendance/v2/pending-approvals/${siteInchargeId}`
      : '/attendance/v2/pending-approvals';
    const { data } = await api.get(url);
    return data;
  },
};
