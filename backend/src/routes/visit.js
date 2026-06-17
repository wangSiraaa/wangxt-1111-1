const express = require('express');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const db = require('../database/init');

const router = express.Router();

function checkBlacklist(plateNumber) {
  const blacklist = db.prepare(`
    SELECT * FROM blacklist 
    WHERE plate_number = ? AND status = 'active'
  `).get(plateNumber);
  return !!blacklist;
}

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
    register_by
  } = req.body;

  if (!plate_number || !visitor_name || !employee_id || !visit_purpose || !visit_date) {
    return res.status(400).json({ error: '缺少必填字段' });
  }

  if (checkBlacklist(plate_number)) {
    return res.status(400).json({ error: '该车辆在黑名单中，无法生成通行证' });
  }

  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(employee_id);
  if (!employee) {
    return res.status(400).json({ error: '受访员工不存在' });
  }

  const recordId = uuidv4();
  const status = 'registered';

  db.prepare(`
    INSERT INTO visit_records (
      id, plate_number, visitor_name, visitor_phone, visitor_company,
      employee_id, employee_name, employee_department, visit_purpose,
      visit_date, expected_enter_time, expected_leave_time,
      status, register_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    register_by || '前台'
  );

  const record = db.prepare('SELECT * FROM visit_records WHERE id = ?').get(recordId);
  res.json({ success: true, data: record, message: '预约登记成功，等待受访员工确认' });
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
  
  res.json({ success: true, data: record });
});

router.post('/:id/confirm', (req, res) => {
  const { id } = req.params;
  const { confirm_by } = req.body;

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
    SET status = 'confirmed', confirm_by = ?, confirm_time = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(confirm_by || record.employee_name, confirmTime, id);

  const updatedRecord = db.prepare('SELECT * FROM visit_records WHERE id = ?').get(id);
  res.json({ success: true, data: updatedRecord, message: '来访已确认' });
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

  const updatedRecord = db.prepare('SELECT * FROM visit_records WHERE id = ?').get(id);
  res.json({ success: true, data: updatedRecord, message: '来访已驳回' });
});

router.post('/:id/enter', (req, res) => {
  const { id } = req.params;
  const { gate_guard, actual_enter_time } = req.body;

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
    return res.status(400).json({ error: '该车辆在黑名单中，禁止入场' });
  }

  const enterTime = actual_enter_time || dayjs().format('YYYY-MM-DD HH:mm:ss');
  
  db.prepare(`
    UPDATE visit_records 
    SET status = 'entered', actual_enter_time = ?, gate_guard_enter = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(enterTime, gate_guard || '保安', id);

  const updatedRecord = db.prepare('SELECT * FROM visit_records WHERE id = ?').get(id);
  res.json({ success: true, data: updatedRecord, message: '车辆已入场' });
});

router.post('/:id/exit', (req, res) => {
  const { id } = req.params;
  const { gate_guard, actual_leave_time } = req.body;

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
    SET status = 'exited', actual_leave_time = ?, gate_guard_leave = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(leaveTime, gate_guard || '保安', id);

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

module.exports = router;
