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

  res.json({
    success: true,
    is_blacklist: !!record,
    data: record || null
  });
});

module.exports = router;
