import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { appealApi } from '../services/api';
import type { BlacklistAppeal } from '../types';

const appealStatusMap: Record<string, { label: string; color: string }> = {
  pending: { label: '待审核', color: '#faad14' },
  approved: { label: '申诉通过', color: '#52c41a' },
  rejected: { label: '申诉驳回', color: '#ff4d4f' },
};

const appealReasonMap: Record<string, string> = {
  misidentification: '误识别（车牌识别错误）',
  vehicle_sold: '车辆已出售/过户',
  borrowed_vehicle: '车辆借出期间违规',
  special_situation: '特殊情况说明',
  other: '其他原因',
};

export default function AppealAuditPage() {
  const [searchParams] = useSearchParams();
  const appealId = searchParams.get('id');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appealList, setAppealList] = useState<BlacklistAppeal[]>([]);
  const [selectedAppeal, setSelectedAppeal] = useState<BlacklistAppeal | null>(null);
  const [auditResult, setAuditResult] = useState<'approved' | 'rejected'>('approved');
  const [auditRemark, setAuditRemark] = useState('');

  useEffect(() => {
    loadAppealList();
  }, []);

  useEffect(() => {
    if (appealId && appealList.length > 0) {
      const appeal = appealList.find(a => a.id === appealId);
      if (appeal) {
        setSelectedAppeal(appeal);
      }
    }
  }, [appealId, appealList]);

  const loadAppealList = async () => {
    setLoading(true);
    try {
      const res = await appealApi.list();
      if (res.success) {
        setAppealList(res.data || []);
      }
    } catch (err: any) {
      setError(err.message || '加载申诉记录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAudit = async () => {
    if (!selectedAppeal) {
      setError('请先选择要审核的申诉');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await appealApi.audit(selectedAppeal.id, {
        result: auditResult,
        remark: auditRemark,
        audit_by: '管理员',
      });
      if (res.success) {
        setSuccess(auditResult === 'approved' ? '申诉已通过，车辆已从黑名单移除' : '申诉已驳回');
        loadAppealList();
        setSelectedAppeal(null);
        setAuditRemark('');
      }
    } catch (err: any) {
      setError(err.message || '审核失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-container">
      <h2 className="page-title">⚖️ 申诉审核</h2>

      {success && <div className="alert alert-success">{success}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="form-row" style={{ gap: '24px' }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ marginBottom: '16px' }}>申诉列表</h3>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>加载中...</div>
          ) : appealList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>暂无申诉记录</div>
          ) : (
            <div className="table-container" style={{ maxHeight: '600px', overflowY: 'auto' }}>
              <table className="table">
                <thead style={{ position: 'sticky', top: 0, background: 'white' }}>
                  <tr>
                    <th>车牌号</th>
                    <th>申请人</th>
                    <th>状态</th>
                    <th>提交时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {appealList.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedAppeal(item)}
                      style={{
                        cursor: 'pointer',
                        background: selectedAppeal?.id === item.id ? '#e6f7ff' : 'transparent',
                      }}
                    >
                      <td style={{ fontFamily: 'monospace' }}>{item.plate_number}</td>
                      <td>{item.appellant_name}</td>
                      <td>
                        <span
                          className="status-tag"
                          style={{ backgroundColor: appealStatusMap[item.status]?.color }}
                        >
                          {appealStatusMap[item.status]?.label}
                        </span>
                      </td>
                      <td>{dayjs(item.created_at).format('YYYY-MM-DD HH:mm')}</td>
                      <td>
                        <button className="btn btn-link" onClick={(e) => { e.stopPropagation(); setSelectedAppeal(item); }}>
                          查看
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: '400px' }}>
          <h3 style={{ marginBottom: '16px' }}>申诉详情</h3>
          {selectedAppeal ? (
            <div style={{ border: '1px solid #e8e8e8', borderRadius: '8px', padding: '20px' }}>
              <div className="form-row">
                <div style={{ flex: 1 }}>
                  <label style={{ color: '#8c8c8c', fontSize: '13px' }}>车牌号</label>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', fontFamily: 'monospace' }}>
                    {selectedAppeal.plate_number}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ color: '#8c8c8c', fontSize: '13px' }}>状态</label>
                  <div>
                    <span
                      className="status-tag"
                      style={{ backgroundColor: appealStatusMap[selectedAppeal.status]?.color }}
                    >
                      {appealStatusMap[selectedAppeal.status]?.label}
                    </span>
                  </div>
                </div>
              </div>

              <div className="form-row" style={{ marginTop: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ color: '#8c8c8c', fontSize: '13px' }}>申请人</label>
                  <div>{selectedAppeal.appellant_name}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ color: '#8c8c8c', fontSize: '13px' }}>联系电话</label>
                  <div>{selectedAppeal.appellant_phone}</div>
                </div>
              </div>

              <div style={{ marginTop: '16px' }}>
                <label style={{ color: '#8c8c8c', fontSize: '13px' }}>申诉原因</label>
                <div>{appealReasonMap[selectedAppeal.appeal_reason] || selectedAppeal.appeal_reason}</div>
              </div>

              <div style={{ marginTop: '16px' }}>
                <label style={{ color: '#8c8c8c', fontSize: '13px' }}>申诉说明</label>
                <div style={{ padding: '12px', background: '#fafafa', borderRadius: '6px', minHeight: '80px' }}>
                  {selectedAppeal.appeal_detail}
                </div>
              </div>

              <div className="form-row" style={{ marginTop: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ color: '#8c8c8c', fontSize: '13px' }}>提交时间</label>
                  <div>{dayjs(selectedAppeal.created_at).format('YYYY-MM-DD HH:mm')}</div>
                </div>
                {selectedAppeal.audited_at && (
                  <div style={{ flex: 1 }}>
                    <label style={{ color: '#8c8c8c', fontSize: '13px' }}>审核时间</label>
                    <div>{dayjs(selectedAppeal.audited_at).format('YYYY-MM-DD HH:mm')}</div>
                  </div>
                )}
              </div>

              {selectedAppeal.audit_remark && (
                <div style={{ marginTop: '16px' }}>
                  <label style={{ color: '#8c8c8c', fontSize: '13px' }}>审核意见</label>
                  <div style={{ padding: '12px', background: '#f0f5ff', borderRadius: '6px' }}>
                    {selectedAppeal.audit_remark}
                  </div>
                </div>
              )}

              {selectedAppeal.status === 'pending' && (
                <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #e8e8e8' }}>
                  <h4 style={{ marginBottom: '16px' }}>审核处理</h4>
                  <div className="form-group">
                    <label className="form-label">
                      <span className="required">*</span>
                      审核结果
                    </label>
                    <div style={{ display: 'flex', gap: '24px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="auditResult"
                          value="approved"
                          checked={auditResult === 'approved'}
                          onChange={(e) => setAuditResult(e.target.value as 'approved' | 'rejected')}
                          style={{ marginRight: '8px' }}
                        />
                        ✅ 通过（移出黑名单）
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="auditResult"
                          value="rejected"
                          checked={auditResult === 'rejected'}
                          onChange={(e) => setAuditResult(e.target.value as 'approved' | 'rejected')}
                          style={{ marginRight: '8px' }}
                        />
                        ❌ 驳回
                      </label>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      <span className="required">*</span>
                      审核意见
                    </label>
                    <textarea
                      className="form-textarea"
                      placeholder="请填写审核意见"
                      value={auditRemark}
                      onChange={(e) => setAuditRemark(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div style={{ textAlign: 'center', marginTop: '16px' }}>
                    <button
                      type="button"
                      className="btn btn-primary btn-lg"
                      onClick={handleAudit}
                      disabled={submitting || !auditRemark}
                      style={{ minWidth: '200px' }}
                    >
                      {submitting ? '提交中...' : '✅ 提交审核结果'}
                    </button>
                  </div>
                </div>
              )}

              {selectedAppeal.status !== 'pending' && (
                <div style={{ textAlign: 'center', marginTop: '16px' }}>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setSelectedAppeal(null)}
                  >
                    返回列表
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '80px', color: '#8c8c8c', border: '1px dashed #d9d9d9', borderRadius: '8px' }}>
              请从左侧列表选择一条申诉记录查看详情
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
