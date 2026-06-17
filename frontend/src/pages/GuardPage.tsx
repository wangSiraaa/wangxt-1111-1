import { useState } from 'react';
import dayjs from 'dayjs';
import { visitApi } from '../services/api';
import type { VisitRecord } from '../types';

export default function GuardPage() {
  const [activeTab, setActiveTab] = useState('enter');
  const [plateNumber, setPlateNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [enterRecords, setEnterRecords] = useState<VisitRecord[]>([]);

  const handleVerify = async () => {
    if (!plateNumber.trim()) {
      setMessage({ type: 'error', text: '请输入车牌号' });
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
    try {
      const res = await visitApi.enter(recordId, {
        gate_guard: '保安',
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

    try {
      const res = await visitApi.exit(recordId, {
        gate_guard: '保安',
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
                    <span className="status-tag status-confirmed">已确认</span>
                  </div>
                  <div className="record-content">
                    <div className="record-item">
                      <strong>访客：</strong>{record.visitor_name}
                      {record.visitor_company && ` (${record.visitor_company})`}
                    </div>
                    <div className="record-item">
                      <strong>受访人：</strong>{record.employee_name} ({record.employee_department})
                    </div>
                    <div className="record-item">
                      <strong>来访事由：</strong>{record.visit_purpose}
                    </div>
                    <div className="record-item">
                      <strong>来访日期：</strong>{record.visit_date}
                    </div>
                    {record.expected_enter_time && (
                      <div className="record-item">
                        <strong>预计入场：</strong>{record.expected_enter_time}
                      </div>
                    )}
                    <div className="record-item">
                      <strong>登记人：</strong>{record.register_by}
                    </div>
                  </div>
                  <div className="record-actions">
                    <button
                      className="btn btn-success"
                      onClick={() => handleEnter(record.id)}
                    >
                      🚗 确认放行
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
                    <span className="status-tag status-entered">已入场</span>
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
                <span className="status-tag status-entered">已入场</span>
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
              </div>
              <div className="record-actions">
                <button
                  className="btn btn-warning"
                  onClick={() => handleExit(record.id)}
                >
                  🏁 确认离场
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
      </div>

      <div className="card verify-section">
        <h3 style={{ marginBottom: '20px' }}>
          {activeTab === 'enter' ? '🔍 入场车牌核验' : '🔍 离场车牌核验'}
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
            disabled={loading}
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

      <div style={{ marginTop: '24px', padding: '16px', background: '#fffbe6', borderRadius: '8px', border: '1px solid #ffe58f' }}>
        <h4 style={{ color: '#d48806', marginBottom: '8px' }}>
          ⚠️ 核验须知
        </h4>
        <ul style={{ color: '#faad14', fontSize: '14px', paddingLeft: '20px', lineHeight: '1.8' }}>
          <li>仔细核对车牌号码与预约信息是否一致</li>
          <li>黑名单车辆禁止入场，需立即上报</li>
          <li>来访事由未确认的车辆不得入场</li>
          <li>车辆离场后通行记录不可撤回，请确认后操作</li>
          <li>如有疑问，请联系前台或受访员工核实</li>
        </ul>
      </div>
    </div>
  );
}
