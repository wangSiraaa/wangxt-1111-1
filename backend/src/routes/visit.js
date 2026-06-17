const express = require('express');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const db = require('../database/init');

const router = express.Router();

const ENTRY_POINTS = [
  { code: 'reception', name: '前台登记', allow_temporary: true },
  { code: 'wechat', name: '微信预约', allow_temporary: true },
  { code: 'employee', name: '员工端', allow_temporary: true },
  { code: 'guardhouse', name: '保安亭', allow_temporary: false },
];

function checkTimeSlot(expectedEnterTime, expectedLeaveTime) {
  if (!expectedEnterTime || !expectedLeaveTime) {
    return { allowed: true, reasons: [] };
  }

  const enterHour = parseInt(expectedEnterTime.split(':')[0]);
  const leaveHour = parseInt(expectedLeaveTime.split(':')[0]);
  const result = { allowed: true, reasons: [] };

  if (enterHour < 7) {
    result.allowed = false;
    result.reasons.push('访客车辆最早入场时间为07:00');
  }
  if (leaveHour > 22) {
    result.allowed = false;
    result.reasons.push('访客车辆最晚离场时间为22:00');
  }
  if (leaveHour - enterHour > 12) {
    result.allowed = false;
    result.reasons.push('单次来访时长不得超过12小时');
  }

  return result;
}

function isTemporaryPass(entryPoint) {
  const ep = ENTRY_POINTS.find(e => e.code === entryPoint);
  return ep ? ep.allow_temporary : false;
}

function checkBlacklist(plateNumber) {
  const blacklist = db.prepare(`
    SELECT * FROM blacklist 
    WHERE plate_number = ? AND status = 'active'
  `).get(plateNumber);
  return !!blacklist;
}

router.get('/entry-points', (req, res) => {
  res.json({
    success: true,
    data: ENTRY_POINTS
  });
});

router.post('/register', (req, res) => {
  const {
    plate_number,
    visitor_name,
    visitor_phone,
    visitor_company,
    employee_id,
    visit_purpose,
    visit_date,
    expected_enter_time,
    expected_leave_time,
    register_by,
    entry_point = 'reception',
    preferred_gate_id,
    companions = [],
    change_type,
    original_visit_id
  } = req.body;

  if (!plate_number || !visitor_name || !employee_id || !visit_purpose || !visit_date) {
    return res.status(400).json({ error: '缺少必填字段' });
  }

  const entryPoint = ENTRY_POINTS.find(e => e.code === entry_point);
  if (!entryPoint) {
    return res.status(400).json({ error: '无效的登记入口' });
  }

  if (checkBlacklist(plate_number)) {
    return res.status(400).json({ error: '该车辆在黑名单中，无法生成通行证。如需申诉，请联系管理员。' });
  }

  const timeCheck = checkTimeSlot(expected_enter_time, expected_leave_time);
  if (!timeCheck.allowed) {
    return res.status(400).json({ error: timeCheck.reasons.join('；') });
  }

  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(employee_id);
  if (!employee) {
    return res.status(400).json({ error: '受访员工不存在' });
  }

  let preferredGate = null;
  if (preferred_gate_id) {
    preferredGate = db.prepare('SELECT * FROM gates WHERE id = ?').get(preferred_gate_id);
    if (!preferredGate) {
      return res.status(400).json({ error: '所选闸口不存在' });
    }
    if (!preferredGate.allow_visitor) {
      return res.status(400).json({ error: `${preferredGate.name}不允许访客车辆通行` });
    }
    const isTemp = isTemporaryPass(entry_point);
    if (isTemp && !preferredGate.allow_temporary) {
      return res.status(400).json({ error: `${preferredGate.name}不允许临时通行证车辆通行` });
    }
  }

  if (original_visit_id && change_type) {
    const originalRecord = db.prepare('SELECT * FROM visit_records WHERE id = ?').get(original_visit_id);
    if (!originalRecord) {
      return res.status(400).json({ error: '原访问记录不存在' });
    }
    if (originalRecord.status === 'exited') {
      return res.status(400).json({ error: '车辆已离场，无法变更' });
    }
    if (!['change_car', 'add_companion', 'change_info'].includes(change_type)) {
      return res.status(400).json({ error: '无效的变更类型' });
    }
  }

  const recordId = uuidv4();
  const status = 'registered';
  const is_temporary = isTemporaryPass(entry_point);

  db.prepare(`
    INSERT INTO visit_records (
      id, plate_number, visitor_name, visitor_phone, visitor_company,
      employee_id, employee_name, employee_department, visit_purpose,
      visit_date, expected_enter_time, expected_leave_time,
      status, register_by, entry_point, entry_point_name,
      preferred_gate_id, preferred_gate_name,
      is_temporary, change_type, original_visit_id,
      companion_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    recordId,
    plate_number.toUpperCase(),
    visitor_name,
    visitor_phone || '',
    visitor_company || '',
    employee_id,
    employee.name,
    employee.department || '',
    visit_purpose,
    visit_date,
    expected_enter_time || null,
    expected_leave_time || null,
    status,
    register_by || '前台',
    entry_point,
    entryPoint.name,
    preferredGate ? preferredGate.id : null,
    preferredGate ? preferredGate.name : null,
    is_temporary ? 1 : 0,
    change_type || null,
    original_visit_id || null,
    companions.length
  );

  for (const companion of companions) {
    const companionId = uuidv4();
    db.prepare(`
      INSERT INTO visit_companions (
        id, visit_id, name, id_card, phone, relation, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      companionId,
      recordId,
      companion.name,
      companion.id_card || '',
      companion.phone || '',
      companion.relation || '',
      new Date().toISOString()
    );
  }

  if (original_visit_id && change_type) {
    db.prepare(`
      UPDATE visit_records 
      SET status = 'changed', changed_to_visit_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(recordId, original_visit_id);

    db.logOperation(original_visit_id, 'change', register_by || '前台', 
      `变更类型: ${change_type === 'change_car' ? '改车' : change_type === 'add_companion' ? '加人' : '信息变更'}, 新记录ID: ${recordId}`,
      { old_visit_id: original_visit_id, new_visit_id: recordId, change_type }
    );
  }

  db.logOperation(recordId, 'register', register_by || '前台', 
    `通过${entryPoint.name}完成预约登记`,
    { entry_point, plate_number: plate_number.toUpperCase() }
  );

  const record = db.prepare('SELECT * FROM visit_records WHERE id = ?').get(recordId);
  const recordCompanions = db.prepare('SELECT * FROM visit_companions WHERE visit_id = ?').all(recordId);
  record.companions = recordCompanions;

  res.json({ 
    success: true, 
    data: record, 
    message: change_type ? '变更申请已提交，需重新审批' : '预约登记成功，等待受访员工确认' 
  });
});

router.get('/list', (req, res) => {
  const { status, plate_number, employee_id, date, page = 1, page_size = 20 } = req.query;
  
  let records = db.prepare(`
    SELECT * FROM visit_records 
    ORDER BY created_at DESC
  `).all();

  if (status) {
    records = records.filter(r => r.status === status);
  }
  if (plate_number) {
    records = records.filter(r => 
      r.plate_number.toLowerCase().includes(plate_number.toLowerCase())
    );
  }
  if (employee_id) {
    records = records.filter(r => r.employee_id === employee_id);
  }
  if (date) {
    records = records.filter(r => r.visit_date === date);
  }

  const total = records.length;
  const offset = (page - 1) * page_size;
  const limit = parseInt(page_size);
  const paginatedRecords = records.slice(offset, offset + limit);

  res.json({
    success: true,
    data: paginatedRecords,
    pagination: {
      page: parseInt(page),
      page_size: limit,
      total,
      total_pages: Math.ceil(total / limit)
    }
  });
});

router.get('/:id', (req, res) => {
  const { id } = req.params;
  const record = db.prepare('SELECT * FROM visit_records WHERE id = ?').get(id);
  
  if (!record) {
    return res.status(404).json({ error: '记录不存在' });
  }
  
  const companions = db.prepare('SELECT * FROM visit_companions WHERE visit_id = ?').all(id);
  record.companions = companions;
  
  res.json({ success: true, data: record });
});

router.get('/:id/companions', (req, res) => {
  const { id } = req.params;
  const record = db.prepare('SELECT * FROM visit_records WHERE id = ?').get(id);
  
  if (!record) {
    return res.status(404).json({ error: '记录不存在' });
  }
  
  const companions = db.prepare('SELECT * FROM visit_companions WHERE visit_id = ?').all(id);
  
  res.json({ 
    success: true, 
    data: companions,
    total: companions.length
  });
});

router.post('/:id/confirm', (req, res) => {
  const { id } = req.params;
  const { confirm_by, confirm_remark } = req.body;

  const record = db.prepare('SELECT * FROM visit_records WHERE id = ?').get(id);
  
  if (!record) {
    return res.status(404).json({ error: '记录不存在' });
  }

  if (record.status !== 'registered') {
    return res.status(400).json({ error: `当前状态为${record.status}，无法进行确认操作` });
  }

  const confirmTime = dayjs().format('YYYY-MM-DD HH:mm:ss');
  
  db.prepare(`
    UPDATE visit_records 
    SET status = 'confirmed', confirm_by = ?, confirm_time = ?, confirm_remark = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(confirm_by || record.employee_name, confirmTime, confirm_remark || '', id);

  db.logOperation(id, 'confirm', confirm_by || record.employee_name, 
    '受访员工确认来访事由',
    { confirm_remark: confirm_remark || '' }
  );

  const updatedRecord = db.prepare('SELECT * FROM visit_records WHERE id = ?').get(id);
  res.json({ success: true, data: updatedRecord, message: '来访已确认，车辆可凭预约信息入场' });
});

router.post('/:id/reject', (req, res) => {
  const { id } = req.params;
  const { reject_reason, confirm_by } = req.body;

  const record = db.prepare('SELECT * FROM visit_records WHERE id = ?').get(id);
  
  if (!record) {
    return res.status(404).json({ error: '记录不存在' });
  }

  if (record.status !== 'registered') {
    return res.status(400).json({ error: `当前状态为${record.status}，无法进行驳回操作` });
  }

  db.prepare(`
    UPDATE visit_records 
    SET status = 'rejected', remark = ?, confirm_by = ?, confirm_time = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(reject_reason || '受访员工驳回', confirm_by || record.employee_name, id);

  db.logOperation(id, 'reject', confirm_by || record.employee_name, 
    `受访员工驳回来访，原因: ${reject_reason || '未说明'}`,
    { reject_reason: reject_reason || '' }
  );

  const updatedRecord = db.prepare('SELECT * FROM visit_records WHERE id = ?').get(id);
  res.json({ success: true, data: updatedRecord, message: '来访已驳回' });
});

router.post('/:id/enter', (req, res) => {
  const { id } = req.params;
  const { gate_guard, actual_enter_time, gate_id } = req.body;

  const record = db.prepare('SELECT * FROM visit_records WHERE id = ?').get(id);
  
  if (!record) {
    return res.status(404).json({ error: '记录不存在' });
  }

  if (record.status === 'entered') {
    return res.status(400).json({ error: '车辆已入场，请勿重复操作' });
  }

  if (record.status === 'exited') {
    return res.status(400).json({ error: '车辆已离场，无法再次入场' });
  }

  if (record.status !== 'confirmed') {
    return res.status(400).json({ error: `当前状态为${record.status}，来访事由未确认，不能入场` });
  }

  if (checkBlacklist(record.plate_number)) {
    return res.status(400).json({ error: '该车辆在黑名单中，禁止入场。如需申诉，请联系管理员。' });
  }

  const now = dayjs();
  const currentTime = now.format('HH:mm');
  const timeCheck = checkTimeSlot(record.expected_enter_time, record.expected_leave_time);
  if (!timeCheck.allowed) {
    return res.status(400).json({ error: timeCheck.reasons.join('；') });
  }

  if (currentTime < '07:00' || currentTime > '22:00') {
    return res.status(400).json({ error: '非来访时段（07:00-22:00），禁止入场' });
  }

  if (gate_id) {
    const gate = db.prepare('SELECT * FROM gates WHERE id = ?').get(gate_id);
    if (gate) {
      if (!gate.allow_visitor) {
        return res.status(400).json({ error: `${gate.name}不允许访客车辆通行，请选择其他闸口` });
      }
      if (record.is_temporary && !gate.allow_temporary) {
        return res.status(400).json({ error: `${gate.name}不允许临时通行证车辆通行` });
      }
    }
  }

  const enterTime = actual_enter_time || now.format('YYYY-MM-DD HH:mm:ss');
  
  db.prepare(`
    UPDATE visit_records 
    SET status = 'entered', actual_enter_time = ?, gate_guard_enter = ?, enter_gate_id = ?, enter_gate_name = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    enterTime, 
    gate_guard || '保安', 
    gate_id || null,
    gate_id ? (db.prepare('SELECT name FROM gates WHERE id = ?').get(gate_id)?.name || null) : null,
    id
  );

  db.logOperation(id, 'enter', gate_guard || '保安', 
    `车辆已入场${gate_id ? `，通过${db.prepare('SELECT name FROM gates WHERE id = ?').get(gate_id)?.name || ''}` : ''}`,
    { gate_id, enter_time: enterTime }
  );

  const updatedRecord = db.prepare('SELECT * FROM visit_records WHERE id = ?').get(id);
  res.json({ success: true, data: updatedRecord, message: '车辆已入场，欢迎进入园区' });
});

router.post('/:id/exit', (req, res) => {
  const { id } = req.params;
  const { gate_guard, actual_leave_time, gate_id } = req.body;

  const record = db.prepare('SELECT * FROM visit_records WHERE id = ?').get(id);
  
  if (!record) {
    return res.status(404).json({ error: '记录不存在' });
  }

  if (record.status !== 'entered') {
    return res.status(400).json({ error: `当前状态为${record.status}，无法进行离场操作` });
  }

  const leaveTime = actual_leave_time || dayjs().format('YYYY-MM-DD HH:mm:ss');
  
  db.prepare(`
    UPDATE visit_records 
    SET status = 'exited', actual_leave_time = ?, gate_guard_leave = ?, exit_gate_id = ?, exit_gate_name = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    leaveTime, 
    gate_guard || '保安',
    gate_id || null,
    gate_id ? (db.prepare('SELECT name FROM gates WHERE id = ?').get(gate_id)?.name || null) : null,
    id
  );

  db.logOperation(id, 'exit', gate_guard || '保安', 
    `车辆已离场${gate_id ? `，通过${db.prepare('SELECT name FROM gates WHERE id = ?').get(gate_id)?.name || ''}` : ''}，通行记录已归档不可撤回`,
    { gate_id, leave_time: leaveTime }
  );

  const updatedRecord = db.prepare('SELECT * FROM visit_records WHERE id = ?').get(id);
  res.json({ success: true, data: updatedRecord, message: '车辆已离场，通行记录不可撤回' });
});

router.post('/verify-plate', (req, res) => {
  const { plate_number } = req.body;

  if (!plate_number) {
    return res.status(400).json({ error: '请输入车牌号' });
  }

  const plate = plate_number.toUpperCase();

  if (checkBlacklist(plate)) {
    return res.json({ 
      success: true, 
      is_blacklist: true,
      message: '该车辆在黑名单中，禁止入场'
    });
  }

  const today = dayjs().format('YYYY-MM-DD');
  const records = db.prepare(`
    SELECT * FROM visit_records 
    WHERE plate_number = ? AND visit_date = ? AND status IN ('confirmed', 'entered')
    ORDER BY created_at DESC
  `).all(plate, today);

  if (records.length === 0) {
    return res.json({ 
      success: true, 
      is_blacklist: false,
      has_valid_record: false,
      message: '今日未查询到有效预约记录'
    });
  }

  res.json({
    success: true,
    is_blacklist: false,
    has_valid_record: true,
    data: records,
    message: `查询到 ${records.length} 条有效预约记录`
  });
});

router.post('/intercept', (req, res) => {
  const {
    plate_number,
    intercept_reason,
    intercept_type,
    gate_id,
    gate_guard,
    visitor_name,
    visitor_phone,
    visit_id
  } = req.body;

  if (!plate_number || !intercept_reason || !intercept_type) {
    return res.status(400).json({ error: '缺少必填字段' });
  }

  const interceptId = uuidv4();
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const gate = gate_id ? db.prepare('SELECT name FROM gates WHERE id = ?').get(gate_id) : null;

  db.prepare(`
    INSERT INTO intercept_records (
      id, plate_number, intercept_reason, intercept_type,
      gate_id, gate_name, gate_guard, visitor_name, visitor_phone,
      visit_id, intercept_time, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `).run(
    interceptId,
    plate_number.toUpperCase(),
    intercept_reason,
    intercept_type,
    gate_id || null,
    gate ? gate.name : null,
    gate_guard || '保安',
    visitor_name || '',
    visitor_phone || '',
    visit_id || null,
    now
  );

  if (visit_id) {
    db.logOperation(visit_id, 'intercept', gate_guard || '保安', 
      `异常拦截：${intercept_type} - ${intercept_reason}`,
      { intercept_id: interceptId, intercept_type, intercept_reason }
    );
  }

  const record = db.prepare('SELECT * FROM intercept_records WHERE id = ?').get(interceptId);
  res.json({ success: true, data: record, message: '异常拦截已记录' });
});

router.get('/intercept/list', (req, res) => {
  const { plate_number, status, start_date, end_date, page = 1, page_size = 20 } = req.query;
  
  let records = db.prepare(`
    SELECT * FROM intercept_records 
    ORDER BY intercept_time DESC
  `).all();

  if (plate_number) {
    records = records.filter(r => r.plate_number.toLowerCase().includes(plate_number.toLowerCase()));
  }
  if (status && status !== 'all') {
    records = records.filter(r => r.status === status);
  }
  if (start_date) {
    records = records.filter(r => r.intercept_time >= start_date);
  }
  if (end_date) {
    records = records.filter(r => r.intercept_time <= end_date + ' 23:59:59');
  }

  const total = records.length;
  const offset = (page - 1) * page_size;
  const limit = parseInt(page_size);
  const paginatedRecords = records.slice(offset, offset + limit);

  res.json({
    success: true,
    data: paginatedRecords,
    pagination: {
      page: parseInt(page),
      page_size: limit,
      total,
      total_pages: Math.ceil(total / limit)
    }
  });
});

router.post('/release-failure', (req, res) => {
  const {
    visit_id,
    plate_number,
    failure_reason,
    failure_type,
    gate_id,
    gate_guard,
    detail
  } = req.body;

  if (!visit_id || !plate_number || !failure_reason || !failure_type) {
    return res.status(400).json({ error: '缺少必填字段' });
  }

  const failureId = uuidv4();
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const gate = gate_id ? db.prepare('SELECT name FROM gates WHERE id = ?').get(gate_id) : null;

  db.prepare(`
    INSERT INTO release_failures (
      id, visit_id, plate_number, failure_reason, failure_type,
      gate_id, gate_name, gate_guard, detail, failure_time, retry_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `).run(
    failureId,
    visit_id,
    plate_number.toUpperCase(),
    failure_reason,
    failure_type,
    gate_id || null,
    gate ? gate.name : null,
    gate_guard || '保安',
    detail || '',
    now
  );

  db.logOperation(visit_id, 'release_failure', gate_guard || '保安', 
    `放行失败：${failure_type} - ${failure_reason}`,
    { failure_id: failureId, failure_type, failure_reason, detail }
  );

  const record = db.prepare('SELECT * FROM release_failures WHERE id = ?').get(failureId);
  res.json({ success: true, data: record, message: '放行失败已记录' });
});

router.get('/release-failure/list', (req, res) => {
  const { visit_id, plate_number, failure_type, start_date, end_date, page = 1, page_size = 20 } = req.query;
  
  let records = db.prepare(`
    SELECT * FROM release_failures 
    ORDER BY failure_time DESC
  `).all();

  if (visit_id) {
    records = records.filter(r => r.visit_id === visit_id);
  }
  if (plate_number) {
    records = records.filter(r => r.plate_number.toLowerCase().includes(plate_number.toLowerCase()));
  }
  if (failure_type && failure_type !== 'all') {
    records = records.filter(r => r.failure_type === failure_type);
  }
  if (start_date) {
    records = records.filter(r => r.failure_time >= start_date);
  }
  if (end_date) {
    records = records.filter(r => r.failure_time <= end_date + ' 23:59:59');
  }

  const total = records.length;
  const offset = (page - 1) * page_size;
  const limit = parseInt(page_size);
  const paginatedRecords = records.slice(offset, offset + limit);

  res.json({
    success: true,
    data: paginatedRecords,
    pagination: {
      page: parseInt(page),
      page_size: limit,
      total,
      total_pages: Math.ceil(total / limit)
    }
  });
});

router.get('/:id/timeline', (req, res) => {
  const { id } = req.params;
  const record = db.prepare('SELECT * FROM visit_records WHERE id = ?').get(id);
  
  if (!record) {
    return res.status(404).json({ error: '记录不存在' });
  }

  const logs = db.prepare(`
    SELECT * FROM operation_logs 
    WHERE visit_id = ? 
    ORDER BY created_at ASC
  `).all(id);

  const timeline = [];

  timeline.push({
    time: record.created_at,
    action: 'register',
    action_name: '预约登记',
    operator: record.register_by,
    detail: `通过${record.entry_point_name || '前台'}完成预约登记`,
    status: 'completed'
  });

  if (record.confirm_time) {
    timeline.push({
      time: record.confirm_time,
      action: record.status === 'rejected' ? 'reject' : 'confirm',
      action_name: record.status === 'rejected' ? '驳回' : '确认来访',
      operator: record.confirm_by,
      detail: record.status === 'rejected' ? `来访已驳回：${record.remark || '未说明原因'}` : '受访员工确认来访事由',
      status: 'completed'
    });
  }

  if (record.actual_enter_time) {
    timeline.push({
      time: record.actual_enter_time,
      action: 'enter',
      action_name: '车辆入场',
      operator: record.gate_guard_enter,
      detail: `车辆已入场${record.enter_gate_name ? `，通过${record.enter_gate_name}` : ''}`,
      status: 'completed'
    });
  }

  if (record.actual_leave_time) {
    timeline.push({
      time: record.actual_leave_time,
      action: 'exit',
      action_name: '车辆离场',
      operator: record.gate_guard_leave,
      detail: `车辆已离场${record.exit_gate_name ? `，通过${record.exit_gate_name}` : ''}，通行记录不可撤回`,
      status: 'completed'
    });
  }

  for (const log of logs) {
    const actionMap = {
      register: '预约登记',
      confirm: '确认来访',
      reject: '驳回来访',
      enter: '车辆入场',
      exit: '车辆离场',
      change: '信息变更',
      intercept: '异常拦截',
      release_failure: '放行失败',
      appeal: '申诉处理'
    };
    if (!['register', 'confirm', 'reject', 'enter', 'exit'].includes(log.action)) {
      timeline.push({
        time: log.created_at,
        action: log.action,
        action_name: actionMap[log.action] || log.action,
        operator: log.operator,
        detail: log.detail,
        status: 'completed',
        extra_data: log.extra_data
      });
    }
  }

  timeline.sort((a, b) => new Date(a.time) - new Date(b.time));

  res.json({
    success: true,
    data: {
      visit_record: record,
      timeline
    }
  });
});

router.post('/:id/cancel', (req, res) => {
  const { id } = req.params;
  const { cancel_reason, operator } = req.body;

  const record = db.prepare('SELECT * FROM visit_records WHERE id = ?').get(id);
  
  if (!record) {
    return res.status(404).json({ error: '记录不存在' });
  }

  if (record.status === 'exited') {
    return res.status(400).json({ error: '车辆已离场，无法取消' });
  }

  if (record.status === 'entered') {
    return res.status(400).json({ error: '车辆已入场，需先进行离场登记' });
  }

  db.prepare(`
    UPDATE visit_records 
    SET status = 'cancelled', remark = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(cancel_reason || '手动取消', id);

  db.logOperation(id, 'cancel', operator || '系统', 
    `预约已取消：${cancel_reason || '未说明原因'}`,
    { cancel_reason: cancel_reason || '' }
  );

  const updatedRecord = db.prepare('SELECT * FROM visit_records WHERE id = ?').get(id);
  res.json({ success: true, data: updatedRecord, message: '预约已取消' });
});

module.exports = router;
