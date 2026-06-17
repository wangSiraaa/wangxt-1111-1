import { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { visitApi } from '../services/api';
import type { VisitRecord } from '../types';

export default function RecordsPage() {
  const [records, setRecords] = useState<VisitRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [pagination, setPagination] = useState({
    page: 1,
    page_size: 20,
    total: 0,
    total_pages: 0,
  });

  useEffect(() => {
    loadRecords();
  }, [status, date, pagination.page]);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const params: any = {
        page: pagination.page,
        page_size: pagination.page_size,
      };
      if (status) params.status = status;
      if (plateNumber) params.plate_number = plateNumber;
      if (date) params.date = date;

      const res = await visitApi.list(params);
      if (res.success) {
        setRecords(res.data || []);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      }
    } catch (err: any) {
      console.error('加载记录失败:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    loadRecords();
  };

  const handleReset = () => {
    setStatus('');
    setPlateNumber('');
    setDate(dayjs().format('YYYY-MM-DD'));
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

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

  const statusOptions = [
    { value: '', label: '全部状态' },
    { value: 'registered', label: '待确认' },
    { value: 'confirmed', label: '已确认' },
    { value: 'rejected', label: '已驳回' },
    { value: 'entered', label: '已入场' },
    { value: 'exited', label: '已离场' },
  ];

  const stats = [
    { label: '今日登记', value: records.filter(r => r.visit_date === dayjs().format('YYYY-MM-DD')).length, color: '#1890ff' },
    { label: '待确认', value: records.filter(r => r.status === 'registered').length, color: '#faad14' },
    { label: '已入场', value: records.filter(r => r.status === 'entered').length, color: '#52c41a' },
    { label: '已离场', value: records.filter(r => r.status === 'exited').length, color: '#8c8c8c' },
  ];

  return (
    <div className="page-container">
      <h2 className="page-title">📋 通行记录查询</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
        {stats.map((stat, index) => (
          <div key={index} className="card" style={{ textAlign: 'center', padding: '20px' }}>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: stat.color }}>
              {stat.value}
            </div>
            <div style={{ fontSize: '14px', color: '#8c8c8c', marginTop: '8px' }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      <div className="search-bar">
        <input
          type="text"
          className="form-input search-input"
          placeholder="搜索车牌号"
          value={plateNumber}
          onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
          style={{ maxWidth: '200px' }}
        />
        <select
          className="form-select"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          style={{ maxWidth: '150px' }}
        >
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <input
          type="date"
          className="form-input"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{ maxWidth: '150px' }}
        />
        <button className="btn btn-primary" onClick={handleSearch}>
          🔍 查询
        </button>
        <button className="btn btn-default" onClick={handleReset}>
          ↺ 重置
        </button>
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
        <>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>车牌号</th>
                  <th>访客</th>
                  <th>受访人</th>
                  <th>来访事由</th>
                  <th>来访日期</th>
                  <th>入场时间</th>
                  <th>离场时间</th>
                  <th>状态</th>
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
                      {record.visitor_phone && (
                        <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                          {record.visitor_phone}
                        </div>
                      )}
                    </td>
                    <td>
                      {record.employee_name}
                      <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                        {record.employee_department}
                      </div>
                    </td>
                    <td style={{ maxWidth: '180px' }}>
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
                    <td style={{ fontSize: '13px', color: '#52c41a' }}>
                      {record.actual_enter_time
                        ? dayjs(record.actual_enter_time).format('MM-DD HH:mm')
                        : '-'}
                    </td>
                    <td style={{ fontSize: '13px', color: '#8c8c8c' }}>
                      {record.actual_leave_time
                        ? dayjs(record.actual_leave_time).format('MM-DD HH:mm')
                        : '-'}
                    </td>
                    <td>
                      <span className={getStatusClass(record.status)}>
                        {getStatusText(record.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination.total_pages > 1 && (
            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <button
                className="btn btn-default btn-sm"
                onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                disabled={pagination.page <= 1}
              >
                上一页
              </button>
              <span style={{ margin: '0 12px', color: '#595959' }}>
                第 {pagination.page} / {pagination.total_pages} 页，共 {pagination.total} 条
              </span>
              <button
                className="btn btn-default btn-sm"
                onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                disabled={pagination.page >= pagination.total_pages}
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
