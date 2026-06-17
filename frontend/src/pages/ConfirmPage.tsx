import { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { visitApi, employeeApi } from '../services/api';
import type { VisitRecord, Employee } from '../types';

export default function ConfirmPage() {
  const [activeTab, setActiveTab] = useState('pending');
  const [records, setRecords] = useState<VisitRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [employeeList, setEmployeeList] = useState<Employee[]>([]);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    if (selectedEmployee && activeTab) {
      loadRecords();
    }
  }, [activeTab, selectedEmployee]);

  const loadEmployees = async () => {
    try {
      const res = await employeeApi.list({ page_size: 50 });
      if (res.success && res.data && res.data.length > 0) {
        setEmployeeList(res.data);
        setSelectedEmployee(res.data[0]);
      }
    } catch (err: any) {
      console.error('加载员工列表失败:', err.message);
    }
  };

  const loadRecords = async () => {
    if (!selectedEmployee) return;
    
    setLoading(true);
    try {
      const params: any = {
        employee_id: selectedEmployee.id,
        page_size: 50,
      };
      if (activeTab !== 'all') {
        params.status = activeTab;
      }
      const res = await visitApi.list(params);
      if (res.success) {
        setRecords(res.data || []);
      }
    } catch (err: any) {
      console.error('加载记录失败:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (id: string) => {
    if (!selectedEmployee) return;
    
    try {
      const res = await visitApi.confirm(id, {
        confirm_by: selectedEmployee.name,
      });
      if (res.success) {
        setMessage({ type: 'success', text: '已确认来访' });
        loadRecords();
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || '操作失败' });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleReject = async (id: string) => {
    if (!selectedEmployee) return;
    
    const reason = window.prompt('请输入驳回原因：', '来访事由不明确');
    if (reason === null) return;
    
    try {
      const res = await visitApi.reject(id, {
        reject_reason: reason,
        confirm_by: selectedEmployee.name,
      });
      if (res.success) {
        setMessage({ type: 'warning', text: '已驳回来访' });
        loadRecords();
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || '操作失败' });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const tabs = [
    { key: 'registered', label: '待确认', count: records.filter(r => r.status === 'registered').length },
    { key: 'confirmed', label: '已确认', count: records.filter(r => r.status === 'confirmed').length },
    { key: 'entered', label: '已入场', count: records.filter(r => r.status === 'entered').length },
    { key: 'exited', label: '已离场', count: records.filter(r => r.status === 'exited').length },
    { key: 'all', label: '全部', count: records.length },
  ];

  const getStatusClass = (status: string) => {
    const map: Record<string, string> = {
      registered: 'status-tag status-registered',
      confirmed: 'status-tag status-confirmed',
      rejected: 'status-tag status-rejected',
      entered: 'status-tag status-entered',
      exited: 'status-tag status-exited',
    };
    return map[status] || 'status-tag';
  };

  const getStatusText = (status: string) => {
    const map: Record<string, string> = {
      registered: '待确认',
      confirmed: '已确认',
      rejected: '已驳回',
      entered: '已入场',
      exited: '已离场',
    };
    return map[status] || status;
  };

  return (
    <div className="page-container">
      <h2 className="page-title">✅ 受访员工确认</h2>

      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.type === 'success' && '✅ '}
          {message.type === 'error' && '❌ '}
          {message.type === 'warning' && '⚠️ '}
          {message.text}
        </div>
      )}

      <div className="card">
        <div className="form-group">
          <label className="form-label">选择员工</label>
          <select
            className="form-select"
            value={selectedEmployee?.id || ''}
            onChange={(e) => {
              const emp = employeeList.find(emp => emp.id === e.target.value);
              setSelectedEmployee(emp || null);
            }}
          >
            <option value="">请选择员工</option>
            {employeeList.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name} - {emp.department} ({emp.employee_no})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="tabs">
        {tabs.map((tab) => (
          <div
            key={tab.key}
            className={`tab-item ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            {tab.count > 0 && <span className="badge">{tab.count}</span>}
          </div>
        ))}
      </div>

      {loading ? (
        <div className="empty-state">
          <div className="empty-state-icon">⏳</div>
          <div className="empty-state-text">加载中...</div>
        </div>
      ) : records.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📭</div>
          <div className="empty-state-text">暂无记录</div>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>车牌号</th>
                <th>访客</th>
                <th>来访事由</th>
                <th>来访日期</th>
                <th>状态</th>
                <th>登记时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td>
                    <strong style={{ letterSpacing: '1px' }}>{record.plate_number}</strong>
                  </td>
                  <td>
                    {record.visitor_name}
                    {record.visitor_company && (
                      <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                        {record.visitor_company}
                      </div>
                    )}
                  </td>
                  <td style={{ maxWidth: '200px' }}>
                    <div style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}>
                      {record.visit_purpose}
                    </div>
                  </td>
                  <td>{record.visit_date}</td>
                  <td>
                    <span className={getStatusClass(record.status)}>
                      {getStatusText(record.status)}
                    </span>
                  </td>
                  <td style={{ fontSize: '12px', color: '#8c8c8c' }}>
                    {dayjs(record.created_at).format('MM-DD HH:mm')}
                  </td>
                  <td>
                    {record.status === 'registered' && (
                      <div className="action-buttons">
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => handleConfirm(record.id)}
                        >
                          ✓ 确认
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleReject(record.id)}
                        >
                          ✕ 驳回
                        </button>
                      </div>
                    )}
                    {record.status !== 'registered' && (
                      <span style={{ color: '#bfbfbf', fontSize: '13px' }}>-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: '24px', padding: '16px', background: '#e6f7ff', borderRadius: '8px', border: '1px solid #91d5ff' }}>
        <h4 style={{ color: '#096dd9', marginBottom: '8px' }}>💡 操作说明</h4>
        <ul style={{ color: '#1890ff', fontSize: '14px', paddingLeft: '20px', lineHeight: '1.8' }}>
          <li>请仔细核对访客信息和来访事由</li>
          <li>确认后来访车辆可凭预约信息入场</li>
          <li>如来访事由不明确或有疑问，请选择驳回并说明原因</li>
          <li>已确认的预约如需取消，请联系前台处理</li>
        </ul>
      </div>
    </div>
  );
}
