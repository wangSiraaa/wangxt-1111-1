import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { visitApi, gateApi } from '../services/api';
import { statusMap, statusColorMap, getGateTypeName } from '../types';
import type { VisitRecord, Gate } from '../types';

type ChangeType = 'change_plate' | 'add_companion';

interface CompanionForm {
  name: string;
  id_card: string;
  phone: string;
  relation: string;
}

export default function ChangeVisitPage() {
  const navigate = useNavigate();
  const { originalId } = useParams<{ originalId: string }>();
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [originalRecord, setOriginalRecord] = useState<VisitRecord | null>(null);
  const [gates, setGates] = useState<Gate[]>([]);
  const [changeType, setChangeType] = useState<ChangeType>('change_plate');
  const [companions, setCompanions] = useState<CompanionForm[]>([]);

  const [formData, setFormData] = useState({
    plate_number: '',
    preferred_gate_id: '',
    change_reason: '',
  });

  useEffect(() => {
    loadGates();
    if (originalId) {
      searchRecord(originalId);
    }
  }, [originalId]);

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

  const searchRecord = async (id?: string) => {
    const searchId = id || searchText.trim();
    if (!searchId) {
      setError('请输入记录ID或车牌号');
      return;
    }

    setSearching(true);
    setError(null);
    setOriginalRecord(null);

    try {
      if (id || /^[0-9a-f-]{36}$/i.test(searchId)) {
        const res = await visitApi.detail(searchId);
        if (res.success && res.data) {
          setOriginalRecord(res.data);
          initFormData(res.data);
        } else {
          setError('未找到该记录');
        }
      } else {
        const res = await visitApi.list({ plate_number: searchId.toUpperCase(), status: 'confirmed,registered,entered' });
        if (res.success && res.data && res.data.length > 0) {
          setOriginalRecord(res.data[0]);
          initFormData(res.data[0]);
        } else {
          setError('未找到可变更的有效记录，请确认车牌号正确且记录状态为待确认、已确认或已入场');
        }
      }
    } catch (err: any) {
      setError(err.message || '查询失败');
    } finally {
      setSearching(false);
    }
  };

  const initFormData = (record: VisitRecord) => {
    setFormData({
      plate_number: record.plate_number,
      preferred_gate_id: record.preferred_gate_id || '',
      change_reason: '',
    });
    if (record.companions) {
      setCompanions(record.companions.map(c => ({
        name: c.name,
        id_card: c.id_card,
        phone: c.phone,
        relation: c.relation
      })));
    } else {
      setCompanions([]);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setSuccess(null);
    setError(null);
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

    if (!originalRecord) {
      setError('请先选择要变更的记录');
      return;
    }

    if (!formData.change_reason) {
      setError('请填写变更原因');
      return;
    }

    if (changeType === 'change_plate' && !formData.plate_number) {
      setError('请输入新车牌号');
      return;
    }

    if (changeType === 'add_companion') {
      const validCompanions = companions.filter(c => c.name.trim());
      if (validCompanions.length === 0) {
        setError('请添加至少一位同行人');
        return;
      }
      if (validCompanions.some(c => !c.id_card || !c.phone)) {
        setError('同行人信息不完整，请完善姓名、身份证号和手机号');
        return;
      }
    }

    setLoading(true);
    try {
      const submitData: any = {
        plate_number: changeType === 'change_plate' ? formData.plate_number : originalRecord.plate_number,
        visitor_name: originalRecord.visitor_name,
        visitor_phone: originalRecord.visitor_phone,
        visitor_company: originalRecord.visitor_company,
        employee_id: originalRecord.employee_id,
        employee_name: originalRecord.employee_name,
        visit_purpose: originalRecord.visit_purpose,
        visit_date: originalRecord.visit_date,
        expected_enter_time: originalRecord.expected_enter_time,
        expected_leave_time: originalRecord.expected_leave_time,
        entry_point: originalRecord.entry_point || 'reception',
        preferred_gate_id: formData.preferred_gate_id || originalRecord.preferred_gate_id,
        change_type: changeType,
        original_visit_id: originalRecord.id,
        change_reason: formData.change_reason,
        register_by: '前台',
      };

      if (changeType === 'add_companion') {
        submitData.companions = companions.filter(c => c.name.trim());
      } else {
        submitData.companions = originalRecord.companions || [];
      }

      const res = await visitApi.register(submitData);
      if (res.success) {
        setSuccess(`变更申请已提交！新记录ID：${res.data?.id}，原记录已标记为"已变更"，需重新审批`);
        setTimeout(() => {
          if (res.data?.id) {
            navigate(`/records/${res.data.id}`);
          }
        }, 2000);
      }
    } catch (err: any) {
      setError(err.message || '提交失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <h2 className="page-title">🔄 变更重审（改车/加人）</h2>

      <div className="alert alert-warning" style={{ marginBottom: '16px' }}>
        ⚠️ 重要提示：变更申请提交后将创建新的访问记录，原记录标记为"已变更"并保留完整轨迹，新记录需重新走审批流程。原记录不会被覆盖或删除。
      </div>

      {success && <div className="alert alert-success">{success}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {!originalRecord && (
        <div style={{ marginBottom: '24px' }}>
          <div className="form-group">
            <label className="form-label">
              <span className="required">*</span>
              查询原记录
            </label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <input
                type="text"
                className="form-input"
                placeholder="请输入记录ID或车牌号查询可变更的记录"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchRecord()}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => searchRecord()}
                disabled={searching}
              >
                {searching ? '查询中...' : '🔍 查询'}
              </button>
            </div>
          </div>
          <div style={{ fontSize: '13px', color: '#8c8c8c', marginTop: '8px' }}>
            可变更的记录状态：待确认、已确认、已入场（已离场记录不可变更）
          </div>
        </div>
      )}

      {originalRecord && (
        <>
          <div style={{ padding: '16px', background: '#e6f7ff', border: '1px solid #91d5ff', borderRadius: '8px', marginBottom: '24px' }}>
            <h4 style={{ color: '#1890ff', marginBottom: '12px' }}>📋 原记录信息</h4>
            <div className="form-row">
              <div style={{ flex: 1 }}>
                <strong>车牌号：</strong>{originalRecord.plate_number}
              </div>
              <div style={{ flex: 1 }}>
                <strong>访客：</strong>{originalRecord.visitor_name}
              </div>
              <div style={{ flex: 1 }}>
                <strong>受访员工：</strong>{originalRecord.employee_name}
              </div>
            </div>
            <div className="form-row" style={{ marginTop: '8px' }}>
              <div style={{ flex: 1 }}>
                <strong>来访日期：</strong>{originalRecord.visit_date}
              </div>
              <div style={{ flex: 1 }}>
                <strong>状态：</strong>
                <span style={{ color: statusColorMap[originalRecord.status as keyof typeof statusColorMap] }}>
                  {statusMap[originalRecord.status as keyof typeof statusMap]}
                </span>
              </div>
              <div style={{ flex: 1 }}>
                <strong>登记入口：</strong>{originalRecord.entry_point_name || '前台登记'}
              </div>
            </div>
            {originalRecord.companions && originalRecord.companions.length > 0 && (
              <div style={{ marginTop: '8px' }}>
                <strong>现有同行人：</strong>
                {originalRecord.companions.map((c, i) => (
                  <span key={i} style={{ marginLeft: '8px' }}>
                    {c.name}{i < originalRecord.companions!.length - 1 ? '、' : ''}
                  </span>
                ))}
              </div>
            )}
            <button
              type="button"
              className="btn btn-link"
              style={{ marginTop: '12px', padding: 0, color: '#1890ff' }}
              onClick={() => {
                setOriginalRecord(null);
                setSearchText('');
              }}
            >
              重新选择记录
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">
                <span className="required">*</span>
                变更类型
              </label>
              <div style={{ display: 'flex', gap: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="changeType"
                    value="change_plate"
                    checked={changeType === 'change_plate'}
                    onChange={(e) => setChangeType(e.target.value as ChangeType)}
                    style={{ marginRight: '8px' }}
                  />
                  🚗 改车（更换车牌）
                </label>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="changeType"
                    value="add_companion"
                    checked={changeType === 'add_companion'}
                    onChange={(e) => setChangeType(e.target.value as ChangeType)}
                    style={{ marginRight: '8px' }}
                  />
                  👥 加人（增加同行人）
                </label>
              </div>
            </div>

            {changeType === 'change_plate' && (
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">
                    <span className="required">*</span>
                    新车牌号
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="请输入新车牌号"
                    value={formData.plate_number}
                    onChange={(e) => handleInputChange('plate_number', e.target.value.toUpperCase())}
                    style={{ textTransform: 'uppercase', letterSpacing: '2px' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">通行闸口</label>
                  <select
                    className="form-input"
                    value={formData.preferred_gate_id}
                    onChange={(e) => handleInputChange('preferred_gate_id', e.target.value)}
                  >
                    <option value="">与原记录一致</option>
                    {gates.map(gate => (
                      <option key={gate.id} value={gate.id}>{gate.name}（{getGateTypeName(gate.type)}）</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {changeType === 'add_companion' && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>
                    <span className="required">*</span>
                    同行人员（新增后将覆盖原同行人列表）
                  </label>
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
                    点击上方"添加同行人"按钮添加需要新增的同行人员
                  </div>
                )}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">
                <span className="required">*</span>
                变更原因
              </label>
              <textarea
                className="form-textarea"
                placeholder="请详细说明变更原因，如：访客临时换车、客户增加随行人员等"
                value={formData.change_reason}
                onChange={(e) => handleInputChange('change_reason', e.target.value)}
              />
            </div>

            <div style={{ marginTop: '24px', textAlign: 'center' }}>
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={loading}
                style={{ minWidth: '200px' }}
              >
                {loading ? '提交中...' : '🔄 提交变更申请'}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
