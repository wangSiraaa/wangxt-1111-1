const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../database/init');

const router = express.Router();

router.get('/', (req, res) => {
  const { plate_number, status = 'active', page = 1, page_size = 20 } = req.query;
  
  let records = db.prepare(`
    SELECT * FROM blacklist 
    ORDER BY added_at DESC
  `).all();

  if (plate_number) {
    records = records.filter(r => 
      r.plate_number.toLowerCase().includes(plate_number.toLowerCase())
    );
  }
  if (status && status !== 'all') {
    records = records.filter(r => r.status === status);
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

router.post('/', (req, res) => {
  const { plate_number, reason, added_by } = req.body;

  if (!plate_number) {
    return res.status(400).json({ error: '车牌号不能为空' });
  }

  const plate = plate_number.toUpperCase();
  
  const existing = db.prepare('SELECT * FROM blacklist WHERE plate_number = ?').get(plate);
  if (existing) {
    if (existing.status === 'active') {
      return res.status(400).json({ error: '该车辆已在黑名单中' });
    } else {
      db.prepare(`
        UPDATE blacklist 
        SET status = 'active', reason = ?, added_by = ?, added_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(reason || '', added_by || 'system', existing.id);
      
      const updated = db.prepare('SELECT * FROM blacklist WHERE id = ?').get(existing.id);
      return res.json({ success: true, data: updated, message: '已重新加入黑名单' });
    }
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO blacklist (id, plate_number, reason, added_by, status)
    VALUES (?, ?, ?, ?, 'active')
  `).run(id, plate, reason || '', added_by || 'system');

  const record = db.prepare('SELECT * FROM blacklist WHERE id = ?').get(id);
  res.json({ success: true, data: record, message: '已加入黑名单' });
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;

  const record = db.prepare('SELECT * FROM blacklist WHERE id = ?').get(id);
  if (!record) {
    return res.status(404).json({ error: '记录不存在' });
  }

  db.prepare(`
    UPDATE blacklist SET status = 'inactive' WHERE id = ?
  `).run(id);

  res.json({ success: true, message: '已移出黑名单' });
});

router.get('/check/:plate_number', (req, res) => {
  const { plate_number } = req.params;
  const plate = plate_number.toUpperCase();
  
  const record = db.prepare(`
    SELECT * FROM blacklist WHERE plate_number = ? AND status = 'active'
  `).get(plate);

  let appeal = null;
  if (record) {
    appeal = db.prepare(`
      SELECT * FROM blacklist_appeals 
      WHERE blacklist_id = ? 
      ORDER BY created_at DESC 
      LIMIT 1
    `).get(record.id);
  }

  res.json({
    success: true,
    is_blacklist: !!record,
    data: record || null,
    latest_appeal: appeal || null
  });
});

router.post('/appeal', (req, res) => {
  const {
    plate_number,
    appellant_name,
    appellant_phone,
    appeal_reason,
    appeal_detail,
    related_visit_id
  } = req.body;

  if (!plate_number || !appellant_name || !appellant_phone || !appeal_reason) {
    return res.status(400).json({ error: '缺少必填字段' });
  }

  const plate = plate_number.toUpperCase();
  
  const blacklistRecord = db.prepare(`
    SELECT * FROM blacklist WHERE plate_number = ? AND status = 'active'
  `).get(plate);

  if (!blacklistRecord) {
    return res.status(400).json({ error: '该车辆不在黑名单中，无需申诉' });
  }

  const existingPendingAppeal = db.prepare(`
    SELECT * FROM blacklist_appeals 
    WHERE blacklist_id = ? AND status = 'pending'
  `).get(blacklistRecord.id);

  if (existingPendingAppeal) {
    return res.status(400).json({ error: '该车辆已有待处理的申诉，请耐心等待审核' });
  }

  const appealId = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO blacklist_appeals (
      id, blacklist_id, plate_number,
      appellant_name, appellant_phone, appeal_reason, appeal_detail,
      related_visit_id, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
  `).run(
    appealId,
    blacklistRecord.id,
    plate,
    appellant_name,
    appellant_phone,
    appeal_reason,
    appeal_detail || '',
    related_visit_id || null,
    now
  );

  db.prepare(`
    UPDATE blacklist 
    SET appeal_status = 'pending', last_appeal_time = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(now, blacklistRecord.id);

  const appeal = db.prepare('SELECT * FROM blacklist_appeals WHERE id = ?').get(appealId);
  
  res.json({ 
    success: true, 
    data: appeal, 
    message: '申诉已提交，等待管理员审核' 
  });
});

router.get('/appeal/list', (req, res) => {
  const { plate_number, status, appellant_name, page = 1, page_size = 20 } = req.query;
  
  let records = db.prepare(`
    SELECT * FROM blacklist_appeals 
    ORDER BY created_at DESC
  `).all();

  if (plate_number) {
    records = records.filter(r => r.plate_number.toLowerCase().includes(plate_number.toLowerCase()));
  }
  if (status && status !== 'all') {
    records = records.filter(r => r.status === status);
  }
  if (appellant_name) {
    records = records.filter(r => r.appellant_name.includes(appellant_name));
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

router.post('/appeal/:id/audit', (req, res) => {
  const { id } = req.params;
  const { audit_result, audit_remark, auditor } = req.body;

  if (!audit_result || !['approved', 'rejected'].includes(audit_result)) {
    return res.status(400).json({ error: '请选择有效的审核结果' });
  }

  const appeal = db.prepare('SELECT * FROM blacklist_appeals WHERE id = ?').get(id);
  
  if (!appeal) {
    return res.status(404).json({ error: '申诉记录不存在' });
  }

  if (appeal.status !== 'pending') {
    return res.status(400).json({ error: '该申诉已处理，无法重复审核' });
  }

  const now = new Date().toISOString();

  db.prepare(`
    UPDATE blacklist_appeals 
    SET status = ?, audit_result = ?, audit_remark = ?, auditor = ?, audited_at = ?
    WHERE id = ?
  `).run(
    audit_result === 'approved' ? 'approved' : 'rejected',
    audit_result,
    audit_remark || '',
    auditor || '管理员',
    now,
    id
  );

  if (audit_result === 'approved') {
    db.prepare(`
      UPDATE blacklist 
      SET status = 'inactive', appeal_status = 'approved', removed_at = ?, removed_by = ?, removed_reason = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(now, auditor || '管理员', `申诉通过：${audit_remark || ''}`, appeal.blacklist_id);
  } else {
    db.prepare(`
      UPDATE blacklist 
      SET appeal_status = 'rejected', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(appeal.blacklist_id);
  }

  const updatedAppeal = db.prepare('SELECT * FROM blacklist_appeals WHERE id = ?').get(id);
  
  res.json({ 
    success: true, 
    data: updatedAppeal, 
    message: audit_result === 'approved' ? '申诉已通过，车辆已移出黑名单' : '申诉已驳回' 
  });
});

router.get('/appeal/:id', (req, res) => {
  const { id } = req.params;
  const appeal = db.prepare('SELECT * FROM blacklist_appeals WHERE id = ?').get(id);
  
  if (!appeal) {
    return res.status(404).json({ error: '申诉记录不存在' });
  }

  const blacklist = db.prepare('SELECT * FROM blacklist WHERE id = ?').get(appeal.blacklist_id);
  appeal.blacklist_record = blacklist;
  
  res.json({ success: true, data: appeal });
});

module.exports = router;
