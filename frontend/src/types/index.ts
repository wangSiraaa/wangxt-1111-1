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
  confirm_remark: string | null;
  gate_guard_enter: string | null;
  gate_guard_leave: string | null;
  remark: string | null;
  created_at: string;
  updated_at: string;
  entry_point: string;
  entry_point_name: string;
  preferred_gate_id: string | null;
  preferred_gate_name: string | null;
  enter_gate_id: string | null;
  enter_gate_name: string | null;
  exit_gate_id: string | null;
  exit_gate_name: string | null;
  is_temporary: number;
  change_type: string | null;
  original_visit_id: string | null;
  changed_to_visit_id: string | null;
  companion_count: number;
  companions?: VisitCompanion[];
}

export type VisitStatus = 'registered' | 'confirmed' | 'rejected' | 'entered' | 'exited' | 'changed' | 'cancelled';

export interface VisitCompanion {
  id: string;
  visit_id: string;
  name: string;
  id_card: string;
  phone: string;
  relation: string;
  created_at: string;
}

export interface Gate {
  id: string;
  name: string;
  code: string;
  type: 'main' | 'employee' | 'cargo';
  allow_visitor: boolean;
  allow_temporary: boolean;
  created_at: string;
}

export const gateTypeMap: Record<Gate['type'], string> = {
  main: '主入口',
  employee: '员工专用',
  cargo: '货运通道',
};

export function getGateTypeName(type: Gate['type']): string {
  return gateTypeMap[type] || type;
}

export interface EntryPoint {
  code: string;
  name: string;
  allow_temporary: boolean;
}

export interface OperationLog {
  id: string;
  visit_id: string;
  action: string;
  operator: string;
  detail: string;
  extra_data: string;
  created_at: string;
}

export interface TimelineItem {
  time: string;
  action: string;
  action_name: string;
  operator: string;
  detail: string;
  status: string;
  extra_data?: string;
}

export interface InterceptRecord {
  id: string;
  plate_number: string;
  intercept_reason: string;
  intercept_type: string;
  gate_id: string | null;
  gate_name: string | null;
  gate_guard: string;
  visitor_name: string;
  visitor_phone: string;
  visit_id: string | null;
  intercept_time: string;
  status: 'pending' | 'resolved';
}

export interface ReleaseFailure {
  id: string;
  visit_id: string;
  plate_number: string;
  failure_reason: string;
  failure_type: string;
  gate_id: string | null;
  gate_name: string | null;
  gate_guard: string;
  detail: string;
  failure_time: string;
  retry_count: number;
}

export interface BlacklistAppeal {
  id: string;
  blacklist_id: string;
  plate_number: string;
  appellant_name: string;
  appellant_phone: string;
  appeal_reason: string;
  appeal_detail: string;
  related_visit_id: string | null;
  status: 'pending' | 'approved' | 'rejected';
  audit_result: string | null;
  audit_remark: string | null;
  auditor: string | null;
  audited_at: string | null;
  created_at: string;
  blacklist_record?: BlacklistItem;
}

export interface BlacklistItem {
  id: string;
  plate_number: string;
  reason: string;
  added_by: string;
  added_at: string;
  status: string;
  appeal_status: string;
  last_appeal_time: string | null;
  removed_at: string | null;
  removed_by: string | null;
  removed_reason: string | null;
}

export interface Employee {
  id: string;
  name: string;
  department: string;
  phone: string;
  email: string;
  employee_no: string;
  created_at: string;
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
  changed: '已变更',
  cancelled: '已取消',
};

export const statusColorMap: Record<VisitStatus, string> = {
  registered: '#faad14',
  confirmed: '#52c41a',
  rejected: '#ff4d4f',
  entered: '#1890ff',
  exited: '#8c8c8c',
  changed: '#722ed1',
  cancelled: '#bfbfbf',
};

export const interceptTypeOptions = [
  { value: 'blacklist', label: '黑名单拦截' },
  { value: 'time_slot', label: '时段不符' },
  { value: 'gate_restriction', label: '闸口限制' },
  { value: 'unconfirmed', label: '未确认' },
  { value: 'other', label: '其他原因' },
];

export const failureTypeOptions = [
  { value: 'system_error', label: '系统异常' },
  { value: 'document_incomplete', label: '证件不全' },
  { value: 'visitor_mismatch', label: '人员不符' },
  { value: 'plate_mismatch', label: '车牌不符' },
  { value: 'other', label: '其他原因' },
];
