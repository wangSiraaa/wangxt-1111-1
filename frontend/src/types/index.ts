export interface VisitRecord {
  id: string;
  plate_number: string;
  visitor_name: string;
  visitor_phone: string;
  visitor_company: string;
  employee_id: string;
  employee_name: string;
  employee_department: string;
  visit_purpose: string;
  visit_date: string;
  expected_enter_time: string | null;
  expected_leave_time: string | null;
  actual_enter_time: string | null;
  actual_leave_time: string | null;
  status: VisitStatus;
  register_by: string;
  confirm_by: string | null;
  confirm_time: string | null;
  gate_guard_enter: string | null;
  gate_guard_leave: string | null;
  remark: string | null;
  created_at: string;
  updated_at: string;
}

export type VisitStatus = 'registered' | 'confirmed' | 'rejected' | 'entered' | 'exited';

export interface Employee {
  id: string;
  name: string;
  department: string;
  phone: string;
  email: string;
  employee_no: string;
  created_at: string;
}

export interface BlacklistItem {
  id: string;
  plate_number: string;
  reason: string;
  added_by: string;
  added_at: string;
  status: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  pagination?: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
}

export const statusMap: Record<VisitStatus, string> = {
  registered: '待确认',
  confirmed: '已确认',
  rejected: '已驳回',
  entered: '已入场',
  exited: '已离场',
};

export const statusColorMap: Record<VisitStatus, string> = {
  registered: '#faad14',
  confirmed: '#52c41a',
  rejected: '#ff4d4f',
  entered: '#1890ff',
  exited: '#8c8c8c',
};
