import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { visitApi, employeeApi } from '../services/api';
import type { Employee } from '../types';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeeList, setEmployeeList] = useState<Employee[]>([]);
  const [showEmployeeList, setShowEmployeeList] = useState(false);

  const [formData, setFormData] = useState({
    plate_number: '',
    visitor_name: '',
    visitor_phone: '',
    visitor_company: '',
    employee_id: '',
    employee_name: '',
    visit_purpose: '',
    visit_date: dayjs().format('YYYY-MM-DD'),
    expected_enter_time: '',
    expected_leave_time: '',
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setSuccess(null);
    setError(null);
  };

  const searchEmployee = async (keyword: string) => {
    setEmployeeSearch(keyword);
    if (keyword.length < 1) {
      setEmployeeList([]);
      setShowEmployeeList(false);
      return;
    }
    try {
      const res = await employeeApi.list({ keyword, page_size: 10 });
      if (res.success) {
        setEmployeeList(res.data || []);
        setShowEmployeeList(true);
      }
    } catch (err: any) {
      console.error('搜索员工失败:', err.message);
    }
  };

  const selectEmployee = (emp: Employee) => {
    setFormData((prev) => ({
      ...prev,
      employee_id: emp.id,
      employee_name: emp.name,
    }));
    setEmployeeSearch(emp.name);
    setShowEmployeeList(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!formData.plate_number) {
      setError('请输入车牌号');
      return;
    }
    if (!formData.visitor_name) {
      setError('请输入访客姓名');
      return;
    }
    if (!formData.employee_id) {
      setError('请选择受访员工');
      return;
    }
    if (!formData.visit_purpose) {
      setError('请输入来访事由');
      return;
    }

    setLoading(true);
    try {
      const res = await visitApi.register({
        ...formData,
        register_by: '前台',
      });
      if (res.success) {
        setSuccess('预约登记成功！已通知受访员工确认来访事由');
        setFormData({
          plate_number: '',
          visitor_name: '',
          visitor_phone: '',
          visitor_company: '',
          employee_id: '',
          employee_name: '',
          visit_purpose: '',
          visit_date: dayjs().format('YYYY-MM-DD'),
          expected_enter_time: '',
          expected_leave_time: '',
        });
        setEmployeeSearch('');
      }
    } catch (err: any) {
      setError(err.message || '登记失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <h2 className="page-title">📝 访客车辆预约登记</h2>

      {success && (
        <div className="alert alert-success">
          ✅ {success}
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          ❌ {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">
              <span className="required">*</span>
              车牌号码
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="请输入车牌号，如：京A12345"
              value={formData.plate_number}
              onChange={(e) => handleInputChange('plate_number', e.target.value.toUpperCase())}
              style={{ textTransform: 'uppercase', letterSpacing: '2px' }}
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              <span className="required">*</span>
              访客姓名
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="请输入访客姓名"
              value={formData.visitor_name}
              onChange={(e) => handleInputChange('visitor_name', e.target.value)}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">联系电话</label>
            <input
              type="tel"
              className="form-input"
              placeholder="请输入访客手机号"
              value={formData.visitor_phone}
              onChange={(e) => handleInputChange('visitor_phone', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">所属公司</label>
            <input
              type="text"
              className="form-input"
              placeholder="请输入访客所属公司"
              value={formData.visitor_company}
              onChange={(e) => handleInputChange('visitor_company', e.target.value)}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">
            <span className="required">*</span>
            受访员工
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              className="form-input"
              placeholder="搜索员工姓名或工号"
              value={formData.employee_name || employeeSearch}
              onChange={(e) => {
                handleInputChange('employee_name', e.target.value);
                handleInputChange('employee_id', '');
                searchEmployee(e.target.value);
              }}
              onFocus={() => {
                if (employeeList.length > 0) setShowEmployeeList(true);
              }}
              onBlur={() => setTimeout(() => setShowEmployeeList(false), 200)}
            />
            {showEmployeeList && employeeList.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: 'white',
                  border: '1px solid #d9d9d9',
                  borderRadius: '6px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  zIndex: 100,
                  maxHeight: '200px',
                  overflowY: 'auto',
                }}
              >
                {employeeList.map((emp) => (
                  <div
                    key={emp.id}
                    style={{
                      padding: '10px 12px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #f0f0f0',
                    }}
                    onClick={() => selectEmployee(emp)}
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    <strong>{emp.name}</strong>
                    <span style={{ color: '#8c8c8c', fontSize: '13px', marginLeft: '8px' }}>
                      {emp.department} · {emp.employee_no}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">
            <span className="required">*</span>
            来访事由
          </label>
          <textarea
            className="form-textarea"
            placeholder="请详细描述来访事由，如：商务洽谈、项目对接、面试等"
            value={formData.visit_purpose}
            onChange={(e) => handleInputChange('visit_purpose', e.target.value)}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">
              <span className="required">*</span>
              来访日期
            </label>
            <input
              type="date"
              className="form-input"
              value={formData.visit_date}
              onChange={(e) => handleInputChange('visit_date', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">预计入场时间</label>
            <input
              type="time"
              className="form-input"
              value={formData.expected_enter_time}
              onChange={(e) => handleInputChange('expected_enter_time', e.target.value)}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">预计离场时间</label>
          <input
            type="time"
            className="form-input"
            value={formData.expected_leave_time}
            onChange={(e) => handleInputChange('expected_leave_time', e.target.value)}
          />
        </div>

        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={loading}
            style={{ minWidth: '200px' }}
          >
            {loading ? '提交中...' : '📋 提交预约登记'}
          </button>
        </div>
      </form>

      <div style={{ marginTop: '32px', padding: '16px', background: '#f6ffed', borderRadius: '8px', border: '1px solid #b7eb8f' }}>
        <h4 style={{ color: '#389e0d', marginBottom: '8px' }}>📌 登记须知</h4>
        <ul style={{ color: '#52c41a', fontSize: '14px', paddingLeft: '20px', lineHeight: '1.8' }}>
          <li>请确保车牌号输入准确，否则将无法正常通行</li>
          <li>预约登记后需等待受访员工确认，确认通过后方可入场</li>
          <li>黑名单车辆无法生成通行证，请务必提前核实</li>
          <li>车辆离场后通行记录将不可撤回</li>
        </ul>
      </div>
    </div>
  );
}
