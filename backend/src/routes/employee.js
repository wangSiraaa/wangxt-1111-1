const express = require('express');
const db = require('../database/init');

const router = express.Router();

router.get('/', (req, res) => {
  const { keyword, department, page = 1, page_size = 50 } = req.query;
  
  const offset = (page - 1) * page_size;
  const limit = parseInt(page_size);

  let employees = db.prepare(`
    SELECT * FROM employees 
    ORDER BY created_at DESC
  `).all();

  if (keyword) {
    const kw = keyword.toLowerCase();
    employees = employees.filter(emp => 
      emp.name.toLowerCase().includes(kw) ||
      emp.employee_no.toLowerCase().includes(kw) ||
      (emp.phone && emp.phone.includes(kw))
    );
  }
  if (department) {
    employees = employees.filter(emp => emp.department === department);
  }

  const total = employees.length;
  const paginatedEmployees = employees.slice(offset, offset + limit);

  res.json({
    success: true,
    data: paginatedEmployees,
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
  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
  
  if (!employee) {
    return res.status(404).json({ error: '员工不存在' });
  }
  
  res.json({ success: true, data: employee });
});

router.get('/department/list', (req, res) => {
  const departments = db.prepare(`
    SELECT DISTINCT department FROM employees 
    WHERE department IS NOT NULL AND department != ''
    ORDER BY department
  `).all();
  
  res.json({ 
    success: true, 
    data: departments.map(d => d.department) 
  });
});

module.exports = router;
