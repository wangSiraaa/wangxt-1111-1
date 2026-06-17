const express = require('express');
const db = require('../database/init');

const router = express.Router();

router.get('/', (req, res) => {
  const { type, allow_visitor } = req.query;
  
  let gates = db.prepare(`
    SELECT * FROM gates 
    ORDER BY code ASC
  `).all();

  if (type && type !== 'all') {
    gates = gates.filter(g => g.type === type);
  }
  if (allow_visitor !== undefined && allow_visitor !== 'all') {
    gates = gates.filter(g => g.allow_visitor === (allow_visitor === 'true'));
  }

  res.json({
    success: true,
    data: gates
  });
});

router.get('/:id', (req, res) => {
  const { id } = req.params;
  const gate = db.prepare('SELECT * FROM gates WHERE id = ?').get(id);
  
  if (!gate) {
    return res.status(404).json({ error: '闸口不存在' });
  }
  
  res.json({ success: true, data: gate });
});

router.post('/:id/check-allow', (req, res) => {
  const { id } = req.params;
  const { pass_type, is_temporary } = req.body;

  const gate = db.prepare('SELECT * FROM gates WHERE id = ?').get(id);
  
  if (!gate) {
    return res.status(404).json({ error: '闸口不存在' });
  }

  const result = {
    gate_id: id,
    gate_name: gate.name,
    allowed: true,
    reasons: []
  };

  if (pass_type === 'visitor' && !gate.allow_visitor) {
    result.allowed = false;
    result.reasons.push(`${gate.name}不允许访客车辆通行`);
  }

  if (is_temporary && !gate.allow_temporary) {
    result.allowed = false;
    result.reasons.push(`${gate.name}不允许临时通行证车辆通行`);
  }

  res.json({
    success: true,
    data: result
  });
});

module.exports = router;
