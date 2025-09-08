// Database type definitions matching the PostgreSQL schema

export type UserRole = 'FOREMAN' | 'SITE_INCHARGE' | 'ADMIN';
export type AttendanceStatus = 'PRESENT' | 'ABSENT';
export type AttendanceReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE';
export type InterpretationMode = 'HOURS' | 'HALF_DAYS' | 'TOTAL_COUNT' | 'P_ONLY';

// Core database entities matching the schema
export interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  password_hash: string;
  role: UserRole;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Site {
  id: string;
  name: string;
  location: string | null;
  notes: string | null;
  full_day_hours: number;
  interpretation_mode: InterpretationMode;
  checkpoint_time: string; // TIME format (HH:MM:SS)
  timezone: string;
  created_at: Date;
  updated_at: Date;
}

export interface Worker {
  id: string;
  name: string;
  father_name: string;
  adhar_number_encrypted: string | null;
  phone_number: string | null;
  site_id: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface UserSiteAssignment {
  id: string;
  user_id: string;
  site_id: string;
  created_at: Date;
}

export interface AttendanceRecord {
  id: string;
  site_id: string;
  worker_id: string;
  date: string; // DATE format (YYYY-MM-DD)
  status: AttendanceStatus;
  x_value: number;
  y_value: number;
  calculated_hours: number; // DECIMAL(5,2)
  submitted_by: string;
  submitted_at: Date;
  submitted_to_incharge: boolean;
  verified: boolean;
  approved_by: string | null;
  approved_at: Date | null;
  original_status: AttendanceStatus | null;
  original_x_value: number | null;
  original_y_value: number | null;
}

// New P/A/HD Attendance Record type
export interface NewAttendanceRecord {
  id: string;
  worker_id: string;
  site_id: string;
  date: string; // DATE format (YYYY-MM-DD)
  P: number;
  A: number;
  HD: number;
  interpretation_mode: 'TOTAL_COUNT' | 'P_ONLY';
  submitted_by: string;
  status: AttendanceReviewStatus;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateNewAttendanceInput {
  worker_id: string;
  site_id: string;
  date: string;
  P: number;
  A: number;
  HD: number;
  interpretation_mode: 'TOTAL_COUNT' | 'P_ONLY';
  submitted_by: string;
  status: AttendanceReviewStatus;
}

export interface UpdateNewAttendanceInput {
  P?: number;
  A?: number;
  HD?: number;
  interpretation_mode?: 'TOTAL_COUNT' | 'P_ONLY';
  status?: AttendanceReviewStatus;
  approved_by?: string;
  approved_at?: string;
}

export interface AuditLog {
  id: string;
  entity_type: string;
  entity_id: string;
  action: AuditAction;
  changed_by: string;
  timestamp: Date;
  old_values: Record<string, any> | null; // JSONB
  new_values: Record<string, any> | null; // JSONB
  metadata: Record<string, any> | null; // JSONB
}

// Input/Create types (without auto-generated fields)
export interface CreateUserInput {
  name: string;
  email: string;
  phone?: string;
  password_hash: string;
  role?: UserRole;
  is_active?: boolean;
}

export interface CreateSiteInput {
  name: string;
  location?: string;
  notes?: string;
  full_day_hours?: number;
  interpretation_mode?: InterpretationMode;
  checkpoint_time?: string;
  timezone?: string;
}

export interface CreateWorkerInput {
  name: string;
  father_name: string;
  adhar_number_encrypted?: string;
  phone_number?: string;
  site_id: string;
  is_active?: boolean;
}

export interface CreateAttendanceRecordInput {
  site_id: string;
  worker_id: string;
  date: string;
  status: AttendanceStatus;
  x_value: number;
  y_value: number;
  calculated_hours: number;
  submitted_by: string;
  submitted_to_incharge?: boolean;
}

export interface CreateAuditLogInput {
  entity_type: string;
  entity_id: string;
  action: AuditAction;
  changed_by: string;
  old_values?: Record<string, any> | undefined;
  new_values?: Record<string, any> | undefined;
  metadata?: Record<string, any> | undefined;
}

// Update types (partial updates)
export interface UpdateUserInput {
  name?: string;
  email?: string;
  phone?: string;
  role?: UserRole;
  is_active?: boolean;
}

export interface UpdateSiteInput {
  name?: string;
  location?: string;
  notes?: string;
  full_day_hours?: number;
  interpretation_mode?: InterpretationMode;
  checkpoint_time?: string;
  timezone?: string;
}

export interface UpdateWorkerInput {
  name?: string;
  father_name?: string;
  adhar_number_encrypted?: string;
  phone_number?: string;
  site_id?: string;
  is_active?: boolean;
}

export interface UpdateAttendanceRecordInput {
  status?: AttendanceStatus;
  x_value?: number;
  y_value?: number;
  calculated_hours?: number;
  verified?: boolean;
  approved_by?: string;
  approved_at?: Date;
  original_status?: AttendanceStatus;
  original_x_value?: number;
  original_y_value?: number;
}

// Extended types with relationships
export interface UserWithSites extends User {
  assigned_sites: Site[];
}

export interface WorkerWithSite extends Worker {
  site: Site;
}

export interface AttendanceRecordWithDetails extends AttendanceRecord {
  worker: Worker;
  site: Site;
  submitted_by_user: User;
  approved_by_user?: User;
}

// Query filter types
export interface AttendanceRecordFilters {
  site_id?: string;
  worker_id?: string;
  date_from?: string;
  date_to?: string;
  status?: AttendanceStatus;
  verified?: boolean;
  submitted_by?: string;
}

export interface WorkerFilters {
  site_id?: string;
  is_active?: boolean;
  search?: string; // for name or father_name search
}

export interface AuditLogFilters {
  entity_type?: string;
  entity_id?: string;
  action?: AuditAction;
  changed_by?: string;
  date_from?: Date;
  date_to?: Date;
}