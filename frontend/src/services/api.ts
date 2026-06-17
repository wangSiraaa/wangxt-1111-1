import axios from 'axios';
import type { ApiResponse, VisitRecord, Employee, BlacklistItem, Gate, EntryPoint, InterceptRecord, ReleaseFailure, BlacklistAppeal, TimelineItem, VisitCompanion } from '../types';

const request = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

request.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.error || error.message || '请求失败';
    return Promise.reject(new Error(message));
  }
);

export const visitApi = {
  register: (data: any): Promise<ApiResponse<VisitRecord>> =>
    request.post('/visit/register', data),

  list: (params?: any): Promise<ApiResponse<VisitRecord[]>> =>
    request.get('/visit/list', { params }),

  detail: (id: string): Promise<ApiResponse<VisitRecord>> =>
    request.get(`/visit/${id}`),

  confirm: (id: string, data?: any): Promise<ApiResponse<VisitRecord>> =>
    request.post(`/visit/${id}/confirm`, data),

  reject: (id: string, data?: any): Promise<ApiResponse<VisitRecord>> =>
    request.post(`/visit/${id}/reject`, data),

  enter: (id: string, data?: any): Promise<ApiResponse<VisitRecord>> =>
    request.post(`/visit/${id}/enter`, data),

  exit: (id: string, data?: any): Promise<ApiResponse<VisitRecord>> =>
    request.post(`/visit/${id}/exit`, data),

  verifyPlate: (plate_number: string): Promise<ApiResponse<any>> =>
    request.post('/visit/verify-plate', { plate_number }),

  getEntryPoints: (): Promise<ApiResponse<EntryPoint[]>> =>
    request.get('/visit/entry-points'),

  getCompanions: (id: string): Promise<ApiResponse<VisitCompanion[]>> =>
    request.get(`/visit/${id}/companions`),

  getTimeline: (id: string): Promise<ApiResponse<{ visit_record: VisitRecord; timeline: TimelineItem[] }>> =>
    request.get(`/visit/${id}/timeline`),

  cancel: (id: string, data?: any): Promise<ApiResponse<VisitRecord>> =>
    request.post(`/visit/${id}/cancel`, data),

  intercept: (data: any): Promise<ApiResponse<InterceptRecord>> =>
    request.post('/visit/intercept', data),

  getInterceptList: (params?: any): Promise<ApiResponse<InterceptRecord[]>> =>
    request.get('/visit/intercept/list', { params }),

  releaseFailure: (data: any): Promise<ApiResponse<ReleaseFailure>> =>
    request.post('/visit/release-failure', data),

  getReleaseFailureList: (params?: any): Promise<ApiResponse<ReleaseFailure[]>> =>
    request.get('/visit/release-failure/list', { params }),
};

export const gateApi = {
  list: (params?: any): Promise<ApiResponse<Gate[]>> =>
    request.get('/gate', { params }),

  detail: (id: string): Promise<ApiResponse<Gate>> =>
    request.get(`/gate/${id}`),

  checkAllow: (id: string, data: any): Promise<ApiResponse<any>> =>
    request.post(`/gate/${id}/check-allow`, data),
};

export const appealApi = {
  submit: (data: any): Promise<ApiResponse<BlacklistAppeal>> =>
    request.post('/blacklist/appeal', data),

  list: (params?: any): Promise<ApiResponse<BlacklistAppeal[]>> =>
    request.get('/blacklist/appeal/list', { params }),

  detail: (id: string): Promise<ApiResponse<BlacklistAppeal>> =>
    request.get(`/blacklist/appeal/${id}`),

  audit: (id: string, data: any): Promise<ApiResponse<BlacklistAppeal>> =>
    request.post(`/blacklist/appeal/${id}/audit`, data),
};

export const employeeApi = {
  list: (params?: any): Promise<ApiResponse<Employee[]>> =>
    request.get('/employee', { params }),

  detail: (id: string): Promise<ApiResponse<Employee>> =>
    request.get(`/employee/${id}`),

  departments: (): Promise<ApiResponse<string[]>> =>
    request.get('/employee/department/list'),
};

export const blacklistApi = {
  list: (params?: any): Promise<ApiResponse<BlacklistItem[]>> =>
    request.get('/blacklist', { params }),

  add: (data: any): Promise<ApiResponse<BlacklistItem>> =>
    request.post('/blacklist', data),

  remove: (id: string): Promise<ApiResponse<any>> =>
    request.delete(`/blacklist/${id}`),

  check: (plate_number: string): Promise<ApiResponse<any>> =>
    request.get(`/blacklist/check/${plate_number}`),
};
