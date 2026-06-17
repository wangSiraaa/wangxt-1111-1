import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { visitApi, appealApi } from '../services/api';
import { statusMap, statusColorMap, interceptTypeOptions, failureTypeOptions } from '../types';
import type { VisitRecord, TimelineItem, InterceptRecord, ReleaseFailure, BlacklistAppeal } from '../types';

export default function RecordDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [record, setRecord] = useState<VisitRecord | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [companions, setCompanions] = useState<any[]>([]);
  const [intercepts, setIntercepts] = useState<InterceptRecord[]>([]);
  const [failures, setFailures] = useState<ReleaseFailure[]>([]);
  const [appeals, setAppeals] = useState<BlacklistAppeal[]>([]);
  const [originalRecord, setOriginalRecord] = useState<VisitRecord | null>(null);
  const [changedRecord, setChangedRecord] = useState<VisitRecord | null>(null);
  const [activeTab, setActiveTab] = useState<'timeline' | 'intercept' | 'failure' | 'appeal'>('timeline');
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);

  useEffect(() => {
    if (id) {
      loadDetail();
    }
  }, [id]);

  const loadDetail = async () => {
    if (!id) return;
    setLoading(true);
    setMessage(null);
    try {
      const [timelineRes, companionsRes, interceptRes, failureRes] = await Promise.all([
        visitApi.getTimeline(id),
        visitApi.getCompanions(id).catch(() => ({ success: false, data: [] })),
        visitApi.getInterceptList({ visit_id: id }).catch(() => ({ success: false, data: [] })),
        visitApi.getReleaseFailureList({ visit_id: id }).catch(() => ({ success: false, data: [] })),
      ]);

      if (timelineRes.success && timelineRes.data) {
        setRecord(timelineRes.data.visit_record);
        setTimeline(timelineRes.data.timeline);
        
        if (timelineRes.data.visit_record.original_visit_id) {
          const origRes = await visitApi.detail(timelineRes.data.visit_record.original_visit_id).catch(() => null);
          if (origRes && origRes.success) {
            setOriginalRecord(origRes.data || null);
          }
        }
        
        if (timelineRes.data.visit_record.changed_to_visit_id) {
          const changedRes = await visitApi.detail(timelineRes.data.visit_record.changed_to_visit_id).catch(() => null);
          if (changedRes && changedRes.success) {
            setChangedRecord(changedRes.data || null);
          }
        }
      }
      
      if (companionsRes.success) {
        setCompanions(companionsRes.data || []);
      }
      
      if (interceptRes.success) {
        setIntercepts(interceptRes.data || []);
      }
      
      if (failureRes.success) {
        setFailures(failureRes.data || []);
      }

      const appealRes = await appealApi.list({ related_visit_id: id }).catch(() => null);
      if (appealRes && appealRes.success) {
        setAppeals(appealRes.data || []);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || '加载详情失败' });
    } finally {
      setLoading(false);
    }
  };

  const getTimelineIcon = (action: string) => {
    const iconMap: Record<string, string> = {
      register: '📝',
      confirm: '✅',
      reject: '❌',
      enter: '🚗',
      exit: '🏁',
      cancel: '🚫',
      changed: '🔄',
      intercept: '🚫',
      release_failure: '⚠️',
      appeal: '📢',
    };
    return iconMap[action] || '📌';
  };

  const getTimelineColor = (action: string, status: string) => {
    if (status === 'pending') return '#faad14';
    const colorMap: Record<string, string> = {
      register: '#1890ff',
      confirm: '#52c41a',
      reject: '#ff4d4f',
      enter: '#1890ff',
      exit: '#8c8c8c',
      cancel: '#bfbfbf',
      changed: '#722ed1',
      intercept: '#ff4d4f',
      release_failure: '#faad14',
      appeal: '#13c2c2',
    };
    return colorMap[action] || '#8c8c8c';
  };

  const interceptTypeMap: Record<string, string> = Object.fromEntries(
    interceptTypeOptions.map(opt => [opt.value, opt.label])
  );

  const failureTypeMap: Record<string, string> = Object.fromEntries(
    failureTypeOptions.map(opt => [opt.value, opt.label])
  );

  const appealStatusMap: Record<string, { text: string; color: string }> = {
    pending: { text: '待审核', color: '#faad14' },
    approved: { text: '申诉通过', color: '#52c41a' },
    rejected: { text: '申诉驳回', color: '#ff4d4f' },
  };

  const changeTypeMap: Record<string, string> = {
    change_plate: '改车',
    add_companion: '加人',
    other: '其他变更',
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <div className="empty-state-icon">⏳</div>
          <div className="empty-state-text">加载中...</div>
        </div>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <div className="empty-state-icon">❌</div>
          <div className="empty-state-text">记录不存在</div>
          <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={() => navigate('/records')}>
            返回列表
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 className="page-title" style={{ margin: 0 }}>
            📋 通行记录详情
          </h2>
          <div style={{ marginTop: '8px', color: '#8c8c8c' }}>
            记录ID：{record.id}
          </div>
        </div>
        <button className="btn btn-default" onClick={() => navigate('/records')}>
          ← 返回列表
        </button>
      </div>

      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
          <div style={{ flex: 1, minWidth: '300px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              <div style={{
                fontSize: '36px',
                fontWeight: 'bold',
                color: '#1890ff',
                letterSpacing: '2px',
                fontFamily: 'monospace',
              }}>
                {record.plate_number}
              </div>
              <span
                className="status-tag"
                style={{ backgroundColor: statusColorMap[record.status] }}
              >
                {statusMap[record.status]}
              </span>
              {record.is_temporary && (
                <span className="status-tag" style={{ backgroundColor: '#722ed1' }}>
                  临时通行证
                </span>
              )}
            </div>

            <div className="form-row">
              <div style={{ flex: 1 }}>
                <strong>访客姓名：</strong>{record.visitor_name}
              </div>
              <div style={{ flex: 1 }}>
                <strong>联系电话：</strong>{record.visitor_phone || '-'}
              </div>
            </div>
            <div className="form-row" style={{ marginTop: '8px' }}>
              <div style={{ flex: 1 }}>
                <strong>访客单位：</strong>{record.visitor_company || '-'}
              </div>
              <div style={{ flex: 1 }}>
                <strong>登记入口：</strong>{record.entry_point_name || '前台登记'}
              </div>
            </div>
            <div className="form-row" style={{ marginTop: '8px' }}>
              <div style={{ flex: 1 }}>
                <strong>受访人：</strong>{record.employee_name}
              </div>
              <div style={{ flex: 1 }}>
                <strong>所属部门：</strong>{record.employee_department}
              </div>
            </div>
            <div className="form-row" style={{ marginTop: '8px' }}>
              <div style={{ flex: 2 }}>
                <strong>来访事由：</strong>{record.visit_purpose}
              </div>
              <div style={{ flex: 1 }}>
                <strong>来访日期：</strong>{record.visit_date}
              </div>
            </div>
            <div className="form-row" style={{ marginTop: '8px' }}>
              <div style={{ flex: 1 }}>
                <strong>预计入场：</strong>{record.expected_enter_time || '-'}
              </div>
              <div style={{ flex: 1 }}>
                <strong>预计离场：</strong>{record.expected_leave_time || '-'}
              </div>
            </div>
            <div className="form-row" style={{ marginTop: '8px' }}>
              <div style={{ flex: 1 }}>
                <strong>实际入场：</strong>
                <span style={{ color: '#52c41a' }}>
                  {record.actual_enter_time ? dayjs(record.actual_enter_time).format('YYYY-MM-DD HH:mm') : '-'}
                </span>
              </div>
              <div style={{ flex: 1 }}>
                <strong>实际离场：</strong>
                <span style={{ color: '#8c8c8c' }}>
                  {record.actual_leave_time ? dayjs(record.actual_leave_time).format('YYYY-MM-DD HH:mm') : '-'}
                </span>
              </div>
            </div>
            {record.enter_gate_name && (
              <div className="form-row" style={{ marginTop: '8px' }}>
                <div style={{ flex: 1 }}>
                  <strong>入场闸口：</strong>{record.enter_gate_name}
                </div>
                {record.exit_gate_name && (
                  <div style={{ flex: 1 }}>
                    <strong>离场闸口：</strong>{record.exit_gate_name}
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ flex: 1, minWidth: '280px', padding: '16px', background: '#fafafa', borderRadius: '8px' }}>
            <h4 style={{ marginBottom: '12px', color: '#1890ff' }}>📌 操作信息</h4>
            <div style={{ fontSize: '14px', lineHeight: '2' }}>
              <div><strong>登记人：</strong>{record.register_by}</div>
              <div><strong>登记时间：</strong>{dayjs(record.created_at).format('YYYY-MM-DD HH:mm')}</div>
              {record.confirm_by && (
                <div><strong>确认人：</strong>{record.confirm_by}</div>
              )}
              {record.confirm_time && (
                <div><strong>确认时间：</strong>{dayjs(record.confirm_time).format('YYYY-MM-DD HH:mm')}</div>
              )}
              {record.gate_guard_enter && (
                <div><strong>入场保安：</strong>{record.gate_guard_enter}</div>
              )}
              {record.gate_guard_leave && (
                <div><strong>离场保安：</strong>{record.gate_guard_leave}</div>
              )}
            </div>

            <div style={{ marginTop: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {record.status === 'registered' && (
                <>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => navigate(`/confirm/${record.id}`)}
                  >
                    ✅ 确认
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => navigate(`/confirm/${record.id}`)}
                  >
                    ❌ 驳回
                  </button>
                </>
              )}
              {record.status === 'confirmed' && (
                <button
                  className="btn btn-success btn-sm"
                  onClick={() => navigate('/guard')}
                >
                  🚗 去放行
                </button>
              )}
              {record.status !== 'exited' && record.status !== 'changed' && record.status !== 'cancelled' && (
                <button
                  className="btn btn-warning btn-sm"
                  onClick={() => navigate(`/change/${record.id}`)}
                >
                  🔄 变更重审
                </button>
              )}
              <button
                className="btn btn-outline btn-sm"
                onClick={() => navigate(`/appeal?plate=${record.plate_number}&visitId=${record.id}`)}
              >
                📢 发起申诉
              </button>
            </div>
          </div>
        </div>

        {(originalRecord || changedRecord || record.change_type) && (
          <div style={{ marginTop: '20px', padding: '16px', background: '#f9f0ff', borderRadius: '8px', border: '1px solid #d3adf7' }}>
            <h4 style={{ marginBottom: '12px', color: '#722ed1' }}>🔄 变更记录</h4>
            {record.change_type && (
              <div style={{ marginBottom: '8px' }}>
                <strong>变更类型：</strong>{changeTypeMap[record.change_type] || record.change_type}
              </div>
            )}
            {originalRecord && (
              <div style={{ marginBottom: '8px' }}>
                <strong>原记录：</strong>
                <span style={{ color: '#1890ff', cursor: 'pointer' }} onClick={() => navigate(`/records/${originalRecord.id}`)}>
                  {originalRecord.plate_number}（{dayjs(originalRecord.created_at).format('MM-DD HH:mm')}）
                </span>
                <span className="status-tag" style={{ marginLeft: '8px', backgroundColor: statusColorMap[originalRecord.status] }}>
                  {statusMap[originalRecord.status]}
                </span>
              </div>
            )}
            {changedRecord && (
              <div>
                <strong>变更为：</strong>
                <span style={{ color: '#1890ff', cursor: 'pointer' }} onClick={() => navigate(`/records/${changedRecord.id}`)}>
                  {changedRecord.plate_number}（{dayjs(changedRecord.created_at).format('MM-DD HH:mm')}）
                </span>
                <span className="status-tag" style={{ marginLeft: '8px', backgroundColor: statusColorMap[changedRecord.status] }}>
                  {statusMap[changedRecord.status]}
                </span>
              </div>
            )}
          </div>
        )}

        {companions.length > 0 && (
          <div style={{ marginTop: '20px' }}>
            <h4 style={{ marginBottom: '12px' }}>👥 同行人（{companions.length}人）</h4>
            <div className="table-container">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>姓名</th>
                    <th>身份证号</th>
                    <th>联系电话</th>
                    <th>与访客关系</th>
                  </tr>
                </thead>
                <tbody>
                  {companions.map((c) => (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td>{c.id_card}</td>
                      <td>{c.phone}</td>
                      <td>{c.relation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {record.remark && (
          <div style={{ marginTop: '20px', padding: '12px', background: '#fffbe6', borderRadius: '6px', border: '1px solid #ffe58f' }}>
            <strong>📝 备注：</strong>{record.remark}
          </div>
        )}
      </div>

      <div className="tabs">
        <div
          className={`tab-item ${activeTab === 'timeline' ? 'active' : ''}`}
          onClick={() => setActiveTab('timeline')}
        >
          🕐 生命周期时间线 ({timeline.length})
        </div>
        <div
          className={`tab-item ${activeTab === 'intercept' ? 'active' : ''}`}
          onClick={() => setActiveTab('intercept')}
        >
          🚫 拦截记录 ({intercepts.length})
        </div>
        <div
          className={`tab-item ${activeTab === 'failure' ? 'active' : ''}`}
          onClick={() => setActiveTab('failure')}
        >
          ⚠️ 失败记录 ({failures.length})
        </div>
        <div
          className={`tab-item ${activeTab === 'appeal' ? 'active' : ''}`}
          onClick={() => setActiveTab('appeal')}
        >
          📢 申诉记录 ({appeals.length})
        </div>
      </div>

      {activeTab === 'timeline' && (
        <div className="card">
          <h3 style={{ marginBottom: '20px' }}>📊 完整生命周期时间线</h3>
          {timeline.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>暂无时间线数据</div>
          ) : (
            <div style={{ position: 'relative', paddingLeft: '40px' }}>
              <div style={{
                position: 'absolute',
                left: '15px',
                top: '5px',
                bottom: '5px',
                width: '2px',
                background: '#e8e8e8',
              }} />
              {timeline.map((item, index) => (
                <div key={index} style={{ position: 'relative', marginBottom: '24px' }}>
                  <div style={{
                    position: 'absolute',
                    left: '-40px',
                    top: '0',
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: getTimelineColor(item.action, item.status),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    zIndex: 1,
                  }}>
                    {getTimelineIcon(item.action)}
                  </div>
                  <div style={{
                    marginLeft: '8px',
                    padding: '16px',
                    background: '#fafafa',
                    borderRadius: '8px',
                    border: '1px solid #e8e8e8',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ color: getTimelineColor(item.action, item.status) }}>
                          {item.action_name}
                        </strong>
                        {item.status === 'pending' && (
                          <span className="status-tag" style={{ backgroundColor: '#faad14' }}>处理中</span>
                        )}
                      </div>
                      <div style={{ fontSize: '13px', color: '#8c8c8c' }}>
                        {dayjs(item.time).format('YYYY-MM-DD HH:mm:ss')}
                      </div>
                    </div>
                    <div style={{ fontSize: '14px', color: '#595959', marginBottom: '8px' }}>
                      {item.detail}
                    </div>
                    <div style={{ fontSize: '13px', color: '#8c8c8c' }}>
                      <strong>操作人：</strong>{item.operator || '系统'}
                    </div>
                    {item.extra_data && item.extra_data !== '{}' && (
                      <div style={{
                        marginTop: '8px',
                        padding: '8px',
                        background: 'white',
                        borderRadius: '4px',
                        fontSize: '12px',
                        color: '#595959',
                        fontFamily: 'monospace',
                        wordBreak: 'break-all',
                      }}>
                        <strong>扩展数据：</strong>
                        {(() => {
                          try {
                            const parsed = JSON.parse(item.extra_data);
                            return Object.entries(parsed).map(([k, v]) => (
                              <div key={k}>
                                <span style={{ color: '#1890ff' }}>{k}</span>: {String(v)}
                              </div>
                            ));
                          } catch {
                            return item.extra_data;
                          }
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'intercept' && (
        <div className="card">
          <h3 style={{ marginBottom: '16px' }}>🚫 异常拦截记录</h3>
          {intercepts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>暂无拦截记录</div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>拦截类型</th>
                    <th>拦截原因</th>
                    <th>拦截闸口</th>
                    <th>拦截人</th>
                    <th>拦截时间</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {intercepts.map((item) => (
                    <tr key={item.id}>
                      <td>{interceptTypeMap[item.intercept_type] || item.intercept_type}</td>
                      <td>{item.intercept_reason}</td>
                      <td>{item.gate_name || '-'}</td>
                      <td>{item.gate_guard}</td>
                      <td>{dayjs(item.intercept_time).format('YYYY-MM-DD HH:mm')}</td>
                      <td>
                        <span className={`status-tag ${item.status === 'resolved' ? 'status-confirmed' : 'status-registered'}`}>
                          {item.status === 'resolved' ? '已处理' : '待处理'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'failure' && (
        <div className="card">
          <h3 style={{ marginBottom: '16px' }}>⚠️ 放行失败记录</h3>
          {failures.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>暂无失败记录</div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>失败类型</th>
                    <th>详细说明</th>
                    <th>闸口</th>
                    <th>操作人</th>
                    <th>重试次数</th>
                    <th>记录时间</th>
                  </tr>
                </thead>
                <tbody>
                  {failures.map((item) => (
                    <tr key={item.id}>
                      <td>{failureTypeMap[item.failure_type] || item.failure_type}</td>
                      <td>{item.detail || item.failure_reason}</td>
                      <td>{item.gate_name || '-'}</td>
                      <td>{item.gate_guard}</td>
                      <td>{item.retry_count || 0}</td>
                      <td>{dayjs(item.failure_time).format('YYYY-MM-DD HH:mm')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'appeal' && (
        <div className="card">
          <h3 style={{ marginBottom: '16px' }}>📢 申诉记录</h3>
          {appeals.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>
              暂无申诉记录
              <div style={{ marginTop: '16px' }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => navigate(`/appeal?plate=${record.plate_number}&visitId=${record.id}`)}
                >
                  📢 发起申诉
                </button>
              </div>
            </div>
          ) : (
            <div>
              {appeals.map((appeal) => (
                <div key={appeal.id} className="record-card" style={{ marginBottom: '16px' }}>
                  <div className="record-header">
                    <span style={{ fontSize: '18px', fontWeight: 'bold' }}>{appeal.plate_number}</span>
                    <span
                      className="status-tag"
                      style={{ backgroundColor: appealStatusMap[appeal.status].color }}
                    >
                      {appealStatusMap[appeal.status].text}
                    </span>
                  </div>
                  <div className="record-content">
                    <div className="form-row">
                      <div style={{ flex: 1 }}>
                        <strong>申诉人：</strong>{appeal.appellant_name}
                      </div>
                      <div style={{ flex: 1 }}>
                        <strong>联系电话：</strong>{appeal.appellant_phone}
                      </div>
                    </div>
                    <div className="form-row" style={{ marginTop: '8px' }}>
                      <div style={{ flex: 1 }}>
                        <strong>申诉原因：</strong>{appeal.appeal_reason}
                      </div>
                    </div>
                    <div style={{ marginTop: '8px' }}>
                      <strong>详细说明：</strong>{appeal.appeal_detail}
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '13px', color: '#8c8c8c' }}>
                      申诉时间：{dayjs(appeal.created_at).format('YYYY-MM-DD HH:mm')}
                    </div>
                    {appeal.status !== 'pending' && (
                      <div style={{ marginTop: '12px', padding: '12px', background: '#f6ffed', borderRadius: '6px' }}>
                        <div><strong>审核结果：</strong>{appeal.audit_result}</div>
                        {appeal.audit_remark && (
                          <div style={{ marginTop: '4px' }}><strong>审核意见：</strong>{appeal.audit_remark}</div>
                        )}
                        <div style={{ marginTop: '4px', fontSize: '13px', color: '#8c8c8c' }}>
                          审核人：{appeal.auditor} | 审核时间：{dayjs(appeal.audited_at!).format('YYYY-MM-DD HH:mm')}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {record.status === 'exited' && (
        <div style={{ marginTop: '20px', padding: '16px', background: '#fffbe6', borderRadius: '8px', border: '1px solid #ffe58f' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>⚠️</span>
            <div>
              <strong>重要提示：</strong>车辆已离场，此通行记录已永久归档，不可修改或撤回。
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
