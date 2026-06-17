const express = require('express');
const cors = require('cors');
const path = require('path');

const dbModule = require('./database/init');
const visitRoutes = require('./routes/visit');
const employeeRoutes = require('./routes/employee');
const blacklistRoutes = require('./routes/blacklist');
const gateRoutes = require('./routes/gate');

// 初始化数据库
dbModule.initDatabase();

const app = express();
const PORT = process.env.PORT || 3005;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/visit', visitRoutes);
app.use('/api/employee', employeeRoutes);
app.use('/api/blacklist', blacklistRoutes);
app.use('/api/gate', gateRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '访客车辆通行系统运行正常' });
});

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ error: err.message || '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});

module.exports = app;
