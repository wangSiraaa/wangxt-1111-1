import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { visitApi, employeeApi, gateApi } from '../services/api';
import type { Employee, EntryPoint, Gate, VisitCompanion } from '../types';
import { getGateTypeName } from '../types';

interface CompanionForm {
  name: string;
  id_card: string;
  phone: string;
  relation: string;
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const { originalId } = useParams<{ originalId: string }>();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeeList, setEmployeeList] = useState<Employee[]>([]);
  const [showEmployeeList, setShowEmployeeList] = useState(false);
  const [entryPoints, setEntryPoints] = useState<EntryPoint[]>([]);
  const [gates, setGates] = useState<Gate[]>([]);
  const [companions, setCompanions] = useState<CompanionForm[]>([]);

  const [formData, setFormData] = useState({
    plate_number: '',
    visitor_name: '',
    visitor_phone: '',
    visitor_company: '',
    employee_id: '',
    employee_name: '',
    visit_purpose: '',
    visit_date: dayjs().format('YYYY-MM-DD'),
    expected_enter_time: '09:00',
    expected_leave_time: '18:00',
    entry_point: 'reception',
    preferred_gate_id: '',
  });

  useEffect(() => {
    loadEntryPoints();
    loadGates();
    if (originalId) {
      loadOriginalRecord();
    }
  }, [originalId]);

  const loadEntryPoints = async () => {
    try {
      const res = await visitApi.getEntryPoints();
      if (res.success) {
        setEntryPoints(res.data || []);
      }
    } catch (err: any) {
      console.error('加载入口类型失败:', err.message);
    }
  };

  const loadGates = async () => {
    try {
      const res = await gateApi.list({ allow_visitor: 'true' });
      if (res.success) {
        setGates(res.data || []);
      }
    } catch (err: any) {
      console.error('加载闸口列表失败:', err.message);
    }
  };

  const loadOriginalRecord = async () => {
    if (!originalId) return;
    try {
      const res = await visitApi.detail(originalId);
      if (res.success && res.data) {
        const r = res.data;
        setFormData(prev => ({
          ...prev,
          plate_number: r.plate_number,
          visitor_name: r.visitor_name,
          visitor_phone: r.visitor_phone,
          visitor_company: r.visitor_company,
          employee_id: r.employee_id,
          employee_name: r.employee_name,
          visit_purpose: r.visit_purpose,
          visit_date: r.visit_date,
          expected_enter_time: r.expected_enter_time || '09:00',
          expected_leave_time: r.expected_leave_time || '18:00',
          preferred_gate_id: r.preferred_gate_id || '',
        }));
        setEmployeeSearch(r.employee_name);
        if (r.companions) {
          setCompanions(r.companions.map(c => ({
            name: c.name,
            id_card: c.id_card,
            phone: c.phone,
            relation: c.relation
          })));
        }
      }
    } catch (err: any) {
      setError('加载原记录失败');
    }
  };

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

  const addCompanion = () => {
    setCompanions([...companions, { name: '', id_card: '', phone: '', relation: '' }]);
  };

  const removeCompanion = (index: number) => {
    setCompanions(companions.filter((_, i) => i !== index));
  };

  const updateCompanion = (index: number, field: keyof CompanionForm, value: string) => {
    const updated = [...companions];
    updated[index] = { ...updated[index], [field]: value };
    setCompanions(updated);
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
    if (!formData.expected_enter_time || !formData.expected_leave_time) {
      setError('请填写预计出入场时间');
      return;
    }

    const enterHour = parseInt(formData.expected_enter_time.split(':')[0]);
    const leaveHour = parseInt(formData.expected_leave_time.split(':')[0]);
    if (enterHour < 7 || leaveHour > 22) {
      setError('来访时段仅限07:00-22:00');
      return;
    }

    const validCompanions = companions.filter(c => c.name.trim());
    if (validCompanions.some(c => !c.id_card || !c.phone)) {
      setError('同行人信息不完整，请完善姓名、身份证号和手机号');
      return;
    }

    setLoading(true);
    try {
      const res = await visitApi.register({
        ...formData,
        register_by: '前台',
        companions: validCompanions,
      });
      if (res.success) {
        setSuccess(originalId ? '变更申请已提交，需重新审批' : '预约登记成功！已通知受访员工确认来访事由');
        if (!originalId) {
          setFormData({
            plate_number: '',
            visitor_name: '',
            visitor_phone: '',
            visitor_company: '',
            employee_id: '',
            employee_name: '',
            visit_purpose: '',
            visit_date: dayjs().format('YYYY-MM-DD'),
            expected_enter_time: '09:00',
            expected_leave_time: '18:00',
            entry_point: 'reception',
            preferred_gate_id: '',
          });
          setEmployeeSearch('');
          setCompanions([]);
        }
      }
    } catch (err: any) {
      setError(err.message || '登记失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <h2 className="page-title">📝 {originalId ? '变更申请（重新审批）' : '访客车辆预约登记'}</h2>

      {originalId && (
        <div className="alert alert-warning" style={{ marginBottom: '16px' }}>
          ⚠️ 这是变更申请，原记录将标记为"已变更"，新记录需重新审批，原记录不会被覆盖
        </div>
      )}

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
              登记入口
            </label>
            <select
              className="form-input"
              value={formData.entry_point}
              onChange={(e) => handleInputChange('entry_point', e.target.value)}
            >
              {entryPoints.map(ep => (
                <option key={ep.code} value={ep.code}>{ep.name}</option>
              ))}
            </select>
          </div>

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
        </div>

        <div className="form-row">
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
        </div>

        <div className="form-row">
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

          <div className="form-group">
            <label className="form-label">
              <span className="required">*</span>
              预计通行闸口
            </label>
            <select
              className="form-input"
              value={formData.preferred_gate_id}
              onChange={(e) => handleInputChange('preferred_gate_id', e.target.value)}
            >
              <option value="">请选择闸口</option>
              {gates.map(gate => (
                <option key={gate.id} value={gate.id}>{gate.name}（{getGateTypeName(gate.type)}）</option>
              ))}
            </select>
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
            <label className="form-label">
              <span className="required">*</span>
              预计入场时间
            </label>
            <input
              type="time"
              className="form-input"
              value={formData.expected_enter_time}
              onChange={(e) => handleInputChange('expected_enter_time', e.target.value)}
              min="07:00"
              max="22:00"
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              <span className="required">*</span>
              预计离场时间
            </label>
            <input
              type="time"
              className="form-input"
              value={formData.expected_leave_time}
              onChange={(e) => handleInputChange('expected_leave_time', e.target.value)}
              min="07:00"
              max="22:00"
            />
          </div>
        </div>

        <div style={{ marginTop: '8px', marginBottom: '16px', padding: '8px 12px', background: '#fff7e6', borderRadius: '4px', fontSize: '13px', color: '#d46b08' }}>
          ℹ️ 来访时段仅限 07:00-22:00，单次访问不超过12小时
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <label className="form-label" style={{ marginBottom: 0 }}>👥 同行人员（可选）</label>
            <button
              type="button"
              className="btn btn-outline"
              style={{ padding: '6px 12px', fontSize: '13px' }}
              onClick={addCompanion}
            >
              + 添加同行人
            </button>
          </div>

          {companions.map((comp, index) => (
            <div key={index} style={{ padding: '12px', border: '1px solid #e8e8e8', borderRadius: '6px', marginBottom: '12px', background: '#fafafa' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <strong>同行人 {index + 1}</strong>
                <button
                  type="button"
                  className="btn btn-link"
                  style={{ color: '#ff4d4f', padding: 0 }}
                  onClick={() => removeCompanion(index)}
                >
                  删除
                </button>
              </div>
              <div className="form-row">
                <div className="form-group" style={{ marginBottom: '8px' }}>
                  <label className="form-label" style={{ fontSize: '12px' }}>姓名</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="请输入姓名"
                    value={comp.name}
                    onChange={(e) => updateCompanion(index, 'name', e.target.value)}
                    style={{ padding: '6px 10px' }}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '8px' }}>
                  <label className="form-label" style={{ fontSize: '12px' }}>身份证号</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="请输入身份证号"
                    value={comp.id_card}
                    onChange={(e) => updateCompanion(index, 'id_card', e.target.value)}
                    style={{ padding: '6px 10px' }}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '8px' }}>
                  <label className="form-label" style={{ fontSize: '12px' }}>手机号</label>
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="请输入手机号"
                    value={comp.phone}
                    onChange={(e) => updateCompanion(index, 'phone', e.target.value)}
                    style={{ padding: '6px 10px' }}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '8px' }}>
                  <label className="form-label" style={{ fontSize: '12px' }}>与访客关系</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="如：同事、客户"
                    value={comp.relation}
                    onChange={(e) => updateCompanion(index, 'relation', e.target.value)}
                    style={{ padding: '6px 10px' }}
                  />
                </div>
              </div>
            </div>
          ))}

          {companions.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px', color: '#8c8c8c', border: '1px dashed #d9d9d9', borderRadius: '6px' }}>
              暂无同行人，点击上方"添加同行人"按钮添加
            </div>
          )}
        </div>

        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={loading}
            style={{ minWidth: '200px' }}
          >
            {loading ? '提交中...' : originalId ? '🔄 提交变更申请' : '📋 提交预约登记'}
          </button>
        </div>
      </form>

      <div style={{ marginTop: '32px', padding: '16px', background: '#f6ffed', borderRadius: '8px', border: '1px solid #b7eb8f' }}>
        <h4 style={{ color: '#389e0d', marginBottom: '8px' }}>📌 登记须知</h4>
        <ul style={{ color: '#52c41a', fontSize: '14px', paddingLeft: '20px', lineHeight: '1.8' }}>
          <li>请确保车牌号输入准确，否则将无法正常通行</li>
          <li>预约登记后需等待受访员工确认，确认通过后方可入场</li>
          <li>黑名单车辆无法生成通行证，请务必提前核实</li>
          <li>如需改车或增加同行人，需提交变更申请并重新审批</li>
          <li>车辆离场后通行记录将不可撤回，所有操作留痕可追溯</li>
          <li>来访时段仅限 07:00-22:00，单次访问不超过12小时</li>
        </ul>
      </div>
    </div>
  );
}
