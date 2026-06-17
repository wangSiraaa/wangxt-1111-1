import { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { visitApi, gateApi } from '../services/api';
import { statusMap, statusColorMap, interceptTypeOptions, failureTypeOptions, getGateTypeName } from '../types';
import type { VisitRecord, Gate, InterceptRecord, ReleaseFailure } from '../types';

export default function GuardPage() {
  const [activeTab, setActiveTab] = useState<'enter' | 'exit' | 'intercept' | 'failure'>('enter');
  const [plateNumber, setPlateNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [enterRecords, setEnterRecords] = useState<VisitRecord[]>([]);
  const [gates, setGates] = useState<Gate[]>([]);
  const [selectedGate, setSelectedGate] = useState('');
  const [interceptList, setInterceptList] = useState<InterceptRecord[]>([]);
  const [failureList, setFailureList] = useState<ReleaseFailure[]>([]);
  const [showInterceptModal, setShowInterceptModal] = useState(false);
  const [showFailureModal, setShowFailureModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<VisitRecord | null>(null);

  const [interceptForm, setInterceptForm] = useState({
    intercept_type: 'blacklist',
    intercept_reason: '',
    detail: '',
  });

  const [failureForm, setFailureForm] = useState({
    failure_type: 'system_error',
    detail: '',
  });

  useEffect(() => {
    loadGates();
  }, []);

  useEffect(() => {
    if (activeTab === 'intercept') {
      loadInterceptList();
    } else if (activeTab === 'failure') {
      loadFailureList();
    }
  }, [activeTab]);

  const loadGates = async () => {
    try {
      const res = await gateApi.list();
      if (res.success) {
        setGates(res.data || []);
        if (res.data && res.data.length > 0) {
          setSelectedGate(res.data[0].id);
        }
      }
    } catch (err: any) {
      console.error('加载闸口列表失败:', err.message);
    }
  };

  const loadInterceptList = async () => {
    try {
      const res = await visitApi.getInterceptList();
      if (res.success) {
        setInterceptList(res.data || []);
      }
    } catch (err: any) {
      console.error('加载拦截记录失败:', err.message);
    }
  };

  const loadFailureList = async () => {
    try {
      const res = await visitApi.getReleaseFailureList();
      if (res.success) {
        setFailureList(res.data || []);
      }
    } catch (err: any) {
      console.error('加载放行失败记录失败:', err.message);
    }
  };

  const checkTimeSlot = () => {
    const now = dayjs();
    const hour = now.hour();
    return hour >= 7 && hour <= 22;
  };

  const handleVerify = async () => {
    if (!plateNumber.trim()) {
      setMessage({ type: 'error', text: '请输入车牌号' });
      return;
    }

    if (!selectedGate) {
      setMessage({ type: 'error', text: '请选择闸口' });
      return;
    }

    if (!checkTimeSlot()) {
      setMessage({ type: 'error', text: '当前时段不在允许通行时间内（07:00-22:00）' });
      return;
    }

    setLoading(true);
    setMessage(null);
    setVerifyResult(null);

    try {
      const res = await visitApi.verifyPlate(plateNumber.trim().toUpperCase());
      if (res.success) {
        setVerifyResult(res);

        if (activeTab === 'exit' && res.data && res.data.length > 0) {
          const enteredRecords = res.data.filter((r: VisitRecord) => r.status === 'entered');
          setEnterRecords(enteredRecords);
        }
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || '核验失败' });
    } finally {
      setLoading(false);
    }
  };

  const handleEnter = async (recordId: string) => {
    if (!selectedGate) {
      setMessage({ type: 'error', text: '请选择闸口' });
      return;
    }

    const selectedGateInfo = gates.find(g => g.id === selectedGate);
    if (selectedGateInfo && !selectedGateInfo.allow_visitor) {
      setMessage({ type: 'error', text: '该闸口不允许访客车辆通行' });
      return;
    }

    try {
      const res = await visitApi.enter(recordId, {
        gate_guard: '保安',
        gate_id: selectedGate,
      });
      if (res.success) {
        setMessage({ type: 'success', text: '✅ 车辆已入场，欢迎进入园区' });
        handleVerify();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || '入场失败' });
    }
  };

  const handleExit = async (recordId: string) => {
    if (!window.confirm('确认车辆离场？离场后通行记录将不可撤回。')) {
      return;
    }

    if (!selectedGate) {
      setMessage({ type: 'error', text: '请选择闸口' });
      return;
    }

    try {
      const res = await visitApi.exit(recordId, {
        gate_guard: '保安',
        gate_id: selectedGate,
      });
      if (res.success) {
        setMessage({ type: 'success', text: '✅ 车辆已离场，感谢您的配合' });
        setPlateNumber('');
        setVerifyResult(null);
        setEnterRecords([]);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || '离场登记失败' });
    }
  };

  const openInterceptModal = (record: VisitRecord) => {
    setSelectedRecord(record);
    setInterceptForm({
      intercept_type: 'blacklist',
      intercept_reason: '',
      detail: '',
    });
    setShowInterceptModal(true);
  };

  const submitIntercept = async () => {
    if (!selectedRecord || !interceptForm.intercept_reason) {
      setMessage({ type: 'error', text: '请填写拦截原因' });
      return;
    }

    try {
      const res = await visitApi.intercept({
        visit_id: selectedRecord.id,
        plate_number: selectedRecord.plate_number,
        gate_id: selectedGate,
        intercept_type: interceptForm.intercept_type,
        intercept_reason: interceptForm.intercept_reason,
        detail: interceptForm.detail,
        gate_guard: '保安',
      });
      if (res.success) {
        setMessage({ type: 'success', text: '✅ 拦截记录已保存' });
        setShowInterceptModal(false);
        loadInterceptList();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || '提交失败' });
    }
  };

  const openFailureModal = (record: VisitRecord) => {
    setSelectedRecord(record);
    setFailureForm({
      failure_type: 'system_error',
      detail: '',
    });
    setShowFailureModal(true);
  };

  const submitFailure = async () => {
    if (!selectedRecord || !failureForm.detail) {
      setMessage({ type: 'error', text: '请填写详细说明' });
      return;
    }

    try {
      const res = await visitApi.releaseFailure({
        visit_id: selectedRecord.id,
        plate_number: selectedRecord.plate_number,
        gate_id: selectedGate,
        failure_type: failureForm.failure_type,
        detail: failureForm.detail,
        gate_guard: '保安',
      });
      if (res.success) {
        setMessage({ type: 'success', text: '✅ 放行失败记录已保存' });
        setShowFailureModal(false);
        loadFailureList();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || '提交失败' });
    }
  };

  const interceptTypeMap: Record<string, string> = Object.fromEntries(
    interceptTypeOptions.map(opt => [opt.value, opt.label])
  );

  const failureTypeMap: Record<string, string> = Object.fromEntries(
    failureTypeOptions.map(opt => [opt.value, opt.label])
  );

  const renderVerifyResult = () => {
    if (!verifyResult) return null;

    if (verifyResult.is_blacklist) {
      return (
        <div className="alert alert-error" style={{ marginBottom: '20px' }}>
          <h3 style={{ marginBottom: '8px' }}>🚫 黑名单车辆</h3>
          <p>该车辆在黑名单中，<strong>禁止入场</strong>！</p>
          <p style={{ fontSize: '13px', marginTop: '8px', color: '#8c8c8c' }}>
            车牌号：{plateNumber.toUpperCase()}
          </p>
          <div style={{ marginTop: '12px', display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              className="btn btn-danger"
              onClick={() => {
                setSelectedRecord(verifyResult);
                openInterceptModal({ id: 'temp', plate_number: plateNumber.toUpperCase() } as VisitRecord);
              }}
            >
              🚫 登记拦截
            </button>
            <button className="btn btn-outline" onClick={() => window.open('/appeal', '_blank')}>
              📢 指引申诉
            </button>
          </div>
        </div>
      );
    }

    if (!verifyResult.has_valid_record) {
      return (
        <div className="alert alert-warning" style={{ marginBottom: '20px' }}>
          <h3 style={{ marginBottom: '8px' }}>⚠️ 无有效预约</h3>
          <p>今日未查询到该车辆的有效预约记录。</p>
          <p style={{ fontSize: '13px', marginTop: '8px' }}>
            请引导访客联系前台或受访员工进行预约登记。
          </p>
          <div style={{ marginTop: '12px', textAlign: 'center' }}>
            <button
              className="btn btn-warning"
              onClick={() => openFailureModal({ id: 'temp', plate_number: plateNumber.toUpperCase() } as VisitRecord)}
            >
              ❌ 登记放行失败
            </button>
          </div>
        </div>
      );
    }

    const records = verifyResult.data || [];

    if (activeTab === 'enter') {
      const confirmedRecords = records.filter((r: VisitRecord) => r.status === 'confirmed');
      const enteredRecords = records.filter((r: VisitRecord) => r.status === 'entered');

      return (
        <div>
          {confirmedRecords.length > 0 && (
            <div>
              <h3 style={{ marginBottom: '12px', color: '#52c41a' }}>
                ✅ 可入场车辆 ({confirmedRecords.length}条有效预约)
              </h3>
              {confirmedRecords.map((record: VisitRecord) => (
                <div key={record.id} className="record-card" style={{ borderLeftColor: '#52c41a' }}>
                  <div className="record-header">
                    <span className="record-plate">{record.plate_number}</span>
                    <span className="status-tag" style={{ backgroundColor: statusColorMap.confirmed }}>
                      {statusMap.confirmed}
                    </span>
                  </div>
                  <div className="record-content">
                    <div className="form-row">
                      <div style={{ flex: 1 }}>
                        <strong>访客：</strong>{record.visitor_name}
                        {record.visitor_company && ` (${record.visitor_company})`}
                      </div>
                      <div style={{ flex: 1 }}>
                        <strong>登记入口：</strong>{record.entry_point_name || '前台登记'}
                      </div>
                      <div style={{ flex: 1 }}>
                        <strong>通行类型：</strong>{record.is_temporary ? '临时通行证' : '预约通行'}
                      </div>
                    </div>
                    <div className="form-row" style={{ marginTop: '8px' }}>
                      <div style={{ flex: 1 }}>
                        <strong>受访人：</strong>{record.employee_name} ({record.employee_department})
                      </div>
                      <div style={{ flex: 1 }}>
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
                      <div style={{ flex: 1 }}>
                        <strong>登记人：</strong>{record.register_by}
                      </div>
                    </div>
                    {record.companions && record.companions.length > 0 && (
                      <div style={{ marginTop: '8px', padding: '8px', background: '#f6ffed', borderRadius: '4px' }}>
                        <strong>同行人 ({record.companions.length}人)：</strong>
                        {record.companions.map((c, i) => (
                          <span key={i} style={{ marginLeft: '8px' }}>
                            {c.name}（{c.relation}）{i < record.companions!.length - 1 ? '、' : ''}
                          </span>
                        ))}
                      </div>
                    )}
                    {record.preferred_gate_name && (
                      <div style={{ marginTop: '8px' }}>
                        <strong>预计闸口：</strong>{record.preferred_gate_name}
                      </div>
                    )}
                  </div>
                  <div className="record-actions" style={{ flexWrap: 'wrap', gap: '8px' }}>
                    <button className="btn btn-success" onClick={() => handleEnter(record.id)}>
                      🚗 确认放行
                    </button>
                    <button className="btn btn-warning" onClick={() => openFailureModal(record)}>
                      ❌ 放行失败
                    </button>
                    <button className="btn btn-danger" onClick={() => openInterceptModal(record)}>
                      🚫 异常拦截
                    </button>
                    <button
                      className="btn btn-outline"
                      onClick={() => window.open(`/records/${record.id}`, '_blank')}
                    >
                      📋 查看详情
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {enteredRecords.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <h3 style={{ marginBottom: '12px', color: '#1890ff' }}>
                🚙 已入场车辆 ({enteredRecords.length}条)
              </h3>
              {enteredRecords.map((record: VisitRecord) => (
                <div key={record.id} className="record-card" style={{ borderLeftColor: '#1890ff' }}>
                  <div className="record-header">
                    <span className="record-plate">{record.plate_number}</span>
                    <span className="status-tag" style={{ backgroundColor: statusColorMap.entered }}>
                      {statusMap.entered}
                    </span>
                  </div>
                  <div className="record-content">
                    <div className="record-item">
                      <strong>访客：</strong>{record.visitor_name}
                    </div>
                    <div className="record-item">
                      <strong>受访人：</strong>{record.employee_name} ({record.employee_department})
                    </div>
                    <div className="record-item">
                      <strong>入场时间：</strong>
                      {record.actual_enter_time
                        ? dayjs(record.actual_enter_time).format('YYYY-MM-DD HH:mm')
                        : '-'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (activeTab === 'exit') {
      if (enterRecords.length === 0) {
        return (
          <div className="alert alert-warning" style={{ marginBottom: '20px' }}>
            <h3 style={{ marginBottom: '8px' }}>⚠️ 无入场记录</h3>
            <p>该车今日无入场记录，无法进行离场登记。</p>
            <div style={{ marginTop: '12px', textAlign: 'center' }}>
              <button
                className="btn btn-warning"
                onClick={() => openFailureModal({ id: 'temp', plate_number: plateNumber.toUpperCase() } as VisitRecord)}
              >
                ❌ 登记离场失败
              </button>
            </div>
          </div>
        );
      }

      return (
        <div>
          <h3 style={{ marginBottom: '12px', color: '#faad14' }}>
            🚗 待离场车辆 ({enterRecords.length}条)
          </h3>
          {enterRecords.map((record: VisitRecord) => (
            <div key={record.id} className="record-card" style={{ borderLeftColor: '#faad14' }}>
              <div className="record-header">
                <span className="record-plate">{record.plate_number}</span>
                <span className="status-tag" style={{ backgroundColor: statusColorMap.entered }}>
                  {statusMap.entered}
                </span>
              </div>
              <div className="record-content">
                <div className="record-item">
                  <strong>访客：</strong>{record.visitor_name}
                </div>
                <div className="record-item">
                  <strong>受访人：</strong>{record.employee_name} ({record.employee_department})
                </div>
                <div className="record-item">
                  <strong>入场时间：</strong>
                  {record.actual_enter_time
                    ? dayjs(record.actual_enter_time).format('YYYY-MM-DD HH:mm')
                    : '-'}
                </div>
                <div className="record-item">
                  <strong>来访事由：</strong>{record.visit_purpose}
                </div>
                {record.companions && record.companions.length > 0 && (
                  <div className="record-item">
                    <strong>同行人：</strong>{record.companions.length}人
                  </div>
                )}
              </div>
              <div className="record-actions" style={{ flexWrap: 'wrap', gap: '8px' }}>
                <button className="btn btn-warning" onClick={() => handleExit(record.id)}>
                  🏁 确认离场
                </button>
                <button
                  className="btn btn-outline"
                  onClick={() => window.open(`/records/${record.id}`, '_blank')}
                >
                  📋 查看详情
                </button>
              </div>
            </div>
          ))}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="page-container">
      <h2 className="page-title">🚗 保安核验放行</h2>

      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="form-row" style={{ marginBottom: '16px' }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label className="form-label">
            <span className="required">*</span>
            当前闸口
          </label>
          <select
            className="form-input"
            value={selectedGate}
            onChange={(e) => setSelectedGate(e.target.value)}
          >
            <option value="">请选择闸口</option>
            {gates.map(gate => (
              <option key={gate.id} value={gate.id}>
                {gate.name}（{getGateTypeName(gate.type)}）{gate.allow_visitor ? ' - 访客可通行' : ' - 访客禁行'}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label className="form-label">当前时间</label>
          <div style={{ padding: '8px 12px', background: checkTimeSlot() ? '#f6ffed' : '#fff1f0', borderRadius: '6px', color: checkTimeSlot() ? '#52c41a' : '#ff4d4f' }}>
            {dayjs().format('YYYY-MM-DD HH:mm:ss')}
            {checkTimeSlot() ? ' ✅ 可通行时段' : ' ❌ 非通行时段（07:00-22:00）'}
          </div>
        </div>
      </div>

      <div className="tabs">
        <div
          className={`tab-item ${activeTab === 'enter' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('enter');
            setVerifyResult(null);
            setPlateNumber('');
          }}
        >
          🚪 入场核验
        </div>
        <div
          className={`tab-item ${activeTab === 'exit' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('exit');
            setVerifyResult(null);
            setPlateNumber('');
            setEnterRecords([]);
          }}
        >
          🏁 离场登记
        </div>
        <div
          className={`tab-item ${activeTab === 'intercept' ? 'active' : ''}`}
          onClick={() => setActiveTab('intercept')}
        >
          🚫 拦截记录
        </div>
        <div
          className={`tab-item ${activeTab === 'failure' ? 'active' : ''}`}
          onClick={() => setActiveTab('failure')}
        >
          ❌ 失败记录
        </div>
      </div>

      {(activeTab === 'enter' || activeTab === 'exit') && (
        <>
          <div className="card verify-section">
            <h3 style={{ marginBottom: '20px' }}>
              🔍 {activeTab === 'enter' ? '入场车牌核验' : '离场车牌核验'}
            </h3>
            <div className="plate-input-wrapper">
              <input
                type="text"
                className="plate-input"
                placeholder="请输入车牌号"
                value={plateNumber}
                onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleVerify();
                  }
                }}
              />
              <button
                className="btn btn-primary verify-btn"
                onClick={handleVerify}
                disabled={loading || !checkTimeSlot()}
              >
                {loading ? '核验中...' : '🔍 核验'}
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {['京A12345', '京B67890', '京A88888'].map((plate) => (
                <button
                  key={plate}
                  className="btn btn-default btn-sm"
                  onClick={() => {
                    setPlateNumber(plate);
                    setTimeout(() => handleVerify(), 100);
                  }}
                >
                  测试：{plate}
                </button>
              ))}
            </div>
          </div>

          {renderVerifyResult()}
        </>
      )}

      {activeTab === 'intercept' && (
        <div>
          <h3 style={{ marginBottom: '16px' }}>🚫 异常拦截记录</h3>
          {interceptList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>暂无拦截记录</div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>车牌号</th>
                    <th>拦截类型</th>
                    <th>拦截原因</th>
                    <th>拦截时间</th>
                    <th>拦截人</th>
                  </tr>
                </thead>
                <tbody>
                  {interceptList.map((item) => (
                    <tr key={item.id}>
                      <td style={{ fontFamily: 'monospace' }}>{item.plate_number}</td>
                      <td>{interceptTypeMap[item.intercept_type] || item.intercept_type}</td>
                      <td>{item.intercept_reason}</td>
                      <td>{dayjs(item.intercept_time).format('YYYY-MM-DD HH:mm')}</td>
                      <td>{item.gate_guard}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'failure' && (
        <div>
          <h3 style={{ marginBottom: '16px' }}>❌ 放行失败记录</h3>
          {failureList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>暂无失败记录</div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>车牌号</th>
                    <th>失败类型</th>
                    <th>详细说明</th>
                    <th>记录时间</th>
                    <th>操作人</th>
                  </tr>
                </thead>
                <tbody>
                  {failureList.map((item) => (
                    <tr key={item.id}>
                      <td style={{ fontFamily: 'monospace' }}>{item.plate_number}</td>
                      <td>{failureTypeMap[item.failure_type] || item.failure_type}</td>
                      <td>{item.detail}</td>
                      <td>{dayjs(item.failure_time).format('YYYY-MM-DD HH:mm')}</td>
                      <td>{item.gate_guard}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: '24px', padding: '16px', background: '#fffbe6', borderRadius: '8px', border: '1px solid #ffe58f' }}>
        <h4 style={{ color: '#d48806', marginBottom: '8px' }}>
          ⚠️ 核验须知
        </h4>
        <ul style={{ color: '#faad14', fontSize: '14px', paddingLeft: '20px', lineHeight: '1.8' }}>
          <li>仔细核对车牌号码与预约信息是否一致</li>
          <li>来访时段仅限 07:00-22:00，非时段禁止通行</li>
          <li>注意闸口类型限制，员工通道、货运通道禁止访客通行</li>
          <li>黑名单车辆禁止入场，需登记拦截并指引申诉</li>
          <li>来访事由未确认的车辆不得入场</li>
          <li>放行失败需登记失败原因，异常情况需登记拦截记录</li>
          <li>车辆离场后通行记录不可撤回，请确认后操作</li>
          <li>核对同行人数量和身份信息，防止无关人员尾随</li>
          <li>如有疑问，请联系前台或受访员工核实</li>
        </ul>
      </div>

      {showInterceptModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{ background: 'white', borderRadius: '8px', padding: '24px', width: '500px', maxWidth: '90%' }}>
            <h3 style={{ marginBottom: '16px' }}>🚫 登记异常拦截</h3>
            <div className="form-group">
              <label className="form-label">
                <span className="required">*</span>
                拦截类型
              </label>
              <select
                className="form-input"
                value={interceptForm.intercept_type}
                onChange={(e) => setInterceptForm({ ...interceptForm, intercept_type: e.target.value })}
              >
                {interceptTypeOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">
                <span className="required">*</span>
                拦截原因
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="请简要说明拦截原因"
                value={interceptForm.intercept_reason}
                onChange={(e) => setInterceptForm({ ...interceptForm, intercept_reason: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">详细说明</label>
              <textarea
                className="form-textarea"
                placeholder="请详细描述拦截情况"
                value={interceptForm.detail}
                onChange={(e) => setInterceptForm({ ...interceptForm, detail: e.target.value })}
                rows={3}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
              <button className="btn btn-outline" onClick={() => setShowInterceptModal(false)}>
                取消
              </button>
              <button className="btn btn-danger" onClick={submitIntercept}>
                🚫 确认拦截
              </button>
            </div>
          </div>
        </div>
      )}

      {showFailureModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{ background: 'white', borderRadius: '8px', padding: '24px', width: '500px', maxWidth: '90%' }}>
            <h3 style={{ marginBottom: '16px' }}>❌ 登记放行失败</h3>
            <div className="form-group">
              <label className="form-label">
                <span className="required">*</span>
                失败类型
              </label>
              <select
                className="form-input"
                value={failureForm.failure_type}
                onChange={(e) => setFailureForm({ ...failureForm, failure_type: e.target.value })}
              >
                {failureTypeOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">
                <span className="required">*</span>
                详细说明
              </label>
              <textarea
                className="form-textarea"
                placeholder="请详细描述放行失败的原因和情况"
                value={failureForm.detail}
                onChange={(e) => setFailureForm({ ...failureForm, detail: e.target.value })}
                rows={3}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
              <button className="btn btn-outline" onClick={() => setShowFailureModal(false)}>
                取消
              </button>
              <button className="btn btn-warning" onClick={submitFailure}>
                ❌ 确认登记
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
