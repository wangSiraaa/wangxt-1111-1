import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { appealApi, blacklistApi } from '../services/api';
import type { BlacklistAppeal, BlacklistItem } from '../types';

const appealStatusMap: Record<string, { label: string; color: string }> = {
  pending: { label: '待审核', color: '#faad14' },
  approved: { label: '申诉通过', color: '#52c41a' },
  rejected: { label: '申诉驳回', color: '#ff4d4f' },
};

export default function AppealPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appealList, setAppealList] = useState<BlacklistAppeal[]>([]);
  const [activeTab, setActiveTab] = useState<'submit' | 'history'>('submit');
  const [blacklistInfo, setBlacklistInfo] = useState<BlacklistItem | null>(null);

  const [formData, setFormData] = useState({
    plate_number: '',
    appellant_name: '',
    appellant_phone: '',
    appeal_reason: '',
    appeal_detail: '',
  });

  useEffect(() => {
    if (activeTab === 'history') {
      loadAppealHistory();
    }
  }, [activeTab]);

  const loadAppealHistory = async () => {
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

  const checkBlacklist = async () => {
    if (!formData.plate_number) {
      setError('请输入车牌号');
      return;
    }

    setLoading(true);
    setError(null);
    setBlacklistInfo(null);

    try {
      const res = await blacklistApi.check(formData.plate_number.toUpperCase());
      if (res.success && res.data?.is_blacklisted) {
        setBlacklistInfo(res.data);
      } else {
        setError('该车牌不在黑名单中，无需申诉');
      }
    } catch (err: any) {
      setError(err.message || '查询失败');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setSuccess(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!formData.plate_number) {
      setError('请输入车牌号');
      return;
    }
    if (!formData.appellant_name) {
      setError('请输入申请人姓名');
      return;
    }
    if (!formData.appellant_phone) {
      setError('请输入申请人电话');
      return;
    }
    if (!formData.appeal_reason) {
      setError('请选择申诉原因');
      return;
    }
    if (!formData.appeal_detail) {
      setError('请填写详细申诉说明');
      return;
    }

    setSubmitting(true);
    try {
      const res = await appealApi.submit({
        ...formData,
        plate_number: formData.plate_number.toUpperCase(),
        blacklist_id: blacklistInfo?.id,
      });
      if (res.success) {
        setSuccess('申诉提交成功！请等待管理员审核');
        setFormData({
          plate_number: '',
          appellant_name: '',
          appellant_phone: '',
          appeal_reason: '',
          appeal_detail: '',
        });
        setBlacklistInfo(null);
      }
    } catch (err: any) {
      setError(err.message || '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-container">
      <h2 className="page-title">📢 黑名单申诉</h2>

      <div className="tabs" style={{ marginBottom: '24px' }}>
        <button
          className={`tab-btn ${activeTab === 'submit' ? 'active' : ''}`}
          onClick={() => setActiveTab('submit')}
        >
          提交申诉
        </button>
        <button
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          申诉记录
        </button>
      </div>

      {success && <div className="alert alert-success">{success}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {activeTab === 'submit' && (
        <div>
          <div style={{ marginBottom: '24px' }}>
            <div className="form-group">
              <label className="form-label">
                <span className="required">*</span>
                查询黑名单
              </label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="请输入车牌号查询是否在黑名单中"
                  value={formData.plate_number}
                  onChange={(e) => handleInputChange('plate_number', e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && checkBlacklist()}
                  style={{ flex: 1, textTransform: 'uppercase' }}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={checkBlacklist}
                  disabled={loading}
                >
                  {loading ? '查询中...' : '🔍 查询'}
                </button>
              </div>
            </div>
          </div>

          {blacklistInfo && (
            <div style={{ padding: '16px', background: '#fff1f0', border: '1px solid #ffccc7', borderRadius: '8px', marginBottom: '24px' }}>
              <h4 style={{ color: '#cf1322', marginBottom: '12px' }}>⚠️ 黑名单信息</h4>
              <div className="form-row">
                <div style={{ flex: 1 }}>
                  <strong>车牌号：</strong>{blacklistInfo.plate_number}
                </div>
                <div style={{ flex: 1 }}>
                  <strong>拉黑原因：</strong>{blacklistInfo.reason}
                </div>
                <div style={{ flex: 1 }}>
                  <strong>拉黑时间：</strong>{dayjs(blacklistInfo.added_at).format('YYYY-MM-DD HH:mm')}
                </div>
              </div>
              {blacklistInfo.reason && (
                <div style={{ marginTop: '8px' }}>
                  <strong>详细说明：</strong>{blacklistInfo.reason}
                </div>
              )}
            </div>
          )}

          {blacklistInfo && (
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">
                    <span className="required">*</span>
                    申请人姓名
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="请输入申请人姓名"
                    value={formData.appellant_name}
                    onChange={(e) => handleInputChange('appellant_name', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <span className="required">*</span>
                    联系电话
                  </label>
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="请输入联系电话"
                    value={formData.appellant_phone}
                    onChange={(e) => handleInputChange('appellant_phone', e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  <span className="required">*</span>
                  申诉原因
                </label>
                <select
                  className="form-input"
                  value={formData.appeal_reason}
                  onChange={(e) => handleInputChange('appeal_reason', e.target.value)}
                >
                  <option value="">请选择申诉原因</option>
                  <option value="misidentification">误识别（车牌识别错误）</option>
                  <option value="vehicle_sold">车辆已出售/过户</option>
                  <option value="borrowed_vehicle">车辆借出期间违规</option>
                  <option value="special_situation">特殊情况说明</option>
                  <option value="other">其他原因</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">
                  <span className="required">*</span>
                  详细申诉说明
                </label>
                <textarea
                    className="form-textarea"
                    placeholder="请详细描述申诉理由、提供相关证明材料说明等"
                    value={formData.appeal_detail}
                    onChange={(e) => handleInputChange('appeal_detail', e.target.value)}
                    rows={5}
                  />
              </div>

              <div style={{ marginTop: '24px', textAlign: 'center' }}>
                <button
                  type="submit"
                  className="btn btn-primary btn-lg"
                  disabled={submitting}
                  style={{ minWidth: '200px' }}
                >
                  {submitting ? '提交中...' : '📋 提交申诉'}
                </button>
              </div>
            </form>
          )}

          {!blacklistInfo && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>
              请先查询车牌号，确认在黑名单中后再提交申诉
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>加载中...</div>
          ) : appealList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>暂无申诉记录</div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>车牌号</th>
                    <th>申请人</th>
                    <th>申诉原因</th>
                    <th>状态</th>
                    <th>提交时间</th>
                    <th>审核时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {appealList.map((item) => (
                    <tr key={item.id}>
                      <td style={{ fontFamily: 'monospace' }}>{item.plate_number}</td>
                      <td>{item.appellant_name}</td>
                      <td>{item.appeal_reason}</td>
                      <td>
                        <span
                          className="status-tag"
                          style={{ backgroundColor: appealStatusMap[item.status]?.color }}
                        >
                          {appealStatusMap[item.status]?.label}
                        </span>
                      </td>
                      <td>{dayjs(item.created_at).format('YYYY-MM-DD HH:mm')}</td>
                      <td>{item.audited_at ? dayjs(item.audited_at).format('YYYY-MM-DD HH:mm') : '-'}</td>
                      <td>
                        <button
                          className="btn btn-link"
                          onClick={() => navigate(`/appeal-audit?id=${item.id}`)}
                        >
                          查看详情
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
