import axios from 'axios';
import type { ApiResponse, VisitRecord, Employee, BlacklistItem } from '../types';

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
