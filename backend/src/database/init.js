const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');

const dataDir = path.join(__dirname, '../../data');
const dbFile = path.join(dataDir, 'data.json');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db = {
  vehicles: [],
  employees: [],
  visitors: [],
  blacklist: [],
  visit_records: [],
  gates: [],
  visit_companions: [],
  operation_logs: [],
  intercept_records: [],
  release_failures: [],
  blacklist_appeals: [],
};

function saveDb() {
  fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
}

function loadDb() {
  if (fs.existsSync(dbFile)) {
    try {
      const data = fs.readFileSync(dbFile, 'utf-8');
      db = JSON.parse(data);
    } catch (e) {
      console.error('加载数据库文件失败:', e.message);
    }
  }
}

function initDatabase() {
  loadDb();

  if (!db.vehicles) db.vehicles = [];
  if (!db.employees) db.employees = [];
  if (!db.visitors) db.visitors = [];
  if (!db.blacklist) db.blacklist = [];
  if (!db.visit_records) db.visit_records = [];
  if (!db.gates) db.gates = [];
  if (!db.visit_companions) db.visit_companions = [];
  if (!db.operation_logs) db.operation_logs = [];
  if (!db.intercept_records) db.intercept_records = [];
  if (!db.release_failures) db.release_failures = [];
  if (!db.blacklist_appeals) db.blacklist_appeals = [];

  if (db.employees.length === 0) {
    db.employees = [
      { id: 'emp_001', name: '张三', department: '技术部', phone: '13800138001', email: 'zhangsan@company.com', employee_no: 'E001', created_at: new Date().toISOString() },
      { id: 'emp_002', name: '李四', department: '市场部', phone: '13800138002', email: 'lisi@company.com', employee_no: 'E002', created_at: new Date().toISOString() },
      { id: 'emp_003', name: '王五', department: '行政部', phone: '13800138003', email: 'wangwu@company.com', employee_no: 'E003', created_at: new Date().toISOString() },
      { id: 'emp_004', name: '赵六', department: '财务部', phone: '13800138004', email: 'zhaoliu@company.com', employee_no: 'E004', created_at: new Date().toISOString() },
    ];
    console.log('初始化员工数据完成');
  }

  if (db.blacklist.length === 0) {
    db.blacklist = [
      { id: 'blk_001', plate_number: '京A88888', reason: '多次违规闯入', added_by: 'system', added_at: new Date().toISOString(), status: 'active', appeal_status: 'none', last_appeal_time: null, removed_at: null, removed_by: null, removed_reason: null },
    ];
    console.log('初始化黑名单数据完成');
  }

  if (db.gates.length === 0) {
    db.gates = [
      { id: 'gate_001', name: '东门', code: 'EAST', type: 'main', allow_visitor: true, allow_temporary: true, created_at: new Date().toISOString() },
      { id: 'gate_002', name: '西门', code: 'WEST', type: 'main', allow_visitor: true, allow_temporary: true, created_at: new Date().toISOString() },
      { id: 'gate_003', name: '南门', code: 'SOUTH', type: 'employee', allow_visitor: false, allow_temporary: false, created_at: new Date().toISOString() },
      { id: 'gate_004', name: '北门', code: 'NORTH', type: 'cargo', allow_visitor: true, allow_temporary: false, created_at: new Date().toISOString() },
    ];
    console.log('初始化闸口数据完成');
  }

  saveDb();
  console.log('数据库初始化完成');
}

if (require.main === module) {
  initDatabase();
}

function prepare(sql) {
  const cleanSql = sql.replace(/\s+/g, ' ').trim();
  
  return {
    get(...params) {
      const countMatch = cleanSql.match(/SELECT\s+COUNT\(\*\)\s+as\s+(\w+)/i);
      const tableMatch = cleanSql.match(/FROM\s+(\w+)/i);
      const whereMatch = cleanSql.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+LIMIT|$)/i);
      
      if (!tableMatch) return null;
      const table = tableMatch[1];
      let data = db[table] || [];
      
      if (whereMatch) {
        const whereClause = whereMatch[1].trim();
        const conditions = parseConditions(whereClause);
        data = data.filter(item => matchConditions(item, conditions, params));
      }

      if (countMatch) {
        return { count: data.length };
      }
      
      return data[0] || null;
    },

    all(...params) {
      const tableMatch = cleanSql.match(/FROM\s+(\w+)/i);
      const whereMatch = cleanSql.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+LIMIT|$)/i);
      const orderMatch = cleanSql.match(/ORDER\s+BY\s+(\w+)\s+(DESC|ASC)?/i);
      const limitMatch = cleanSql.match(/LIMIT\s+(\d+)/i);
      const offsetMatch = cleanSql.match(/OFFSET\s+(\d+)/i);

      if (!tableMatch) return [];
      const table = tableMatch[1];
      let data = [...(db[table] || [])];

      if (whereMatch) {
        const whereClause = whereMatch[1].trim();
        const conditions = parseConditions(whereClause);
        data = data.filter(item => matchConditions(item, conditions, params));
      }

      if (orderMatch) {
        const orderField = orderMatch[1];
        const orderDir = (orderMatch[2] || 'ASC').toUpperCase();
        data.sort((a, b) => {
          const valA = a[orderField];
          const valB = b[orderField];
          if (valA < valB) return orderDir === 'ASC' ? -1 : 1;
          if (valA > valB) return orderDir === 'ASC' ? 1 : -1;
          return 0;
        });
      }

      const limit = limitMatch ? parseInt(limitMatch[1]) : null;
      const offset = offsetMatch ? parseInt(offsetMatch[1]) : 0;

      if (limit !== null) {
        data = data.slice(offset, offset + limit);
      } else if (offset > 0) {
        data = data.slice(offset);
      }

      return data;
    },

    run(...params) {
      if (cleanSql.toUpperCase().startsWith('INSERT')) {
        return handleInsert(cleanSql, params);
      } else if (cleanSql.toUpperCase().startsWith('UPDATE')) {
        return handleUpdate(cleanSql, params);
      } else if (cleanSql.toUpperCase().startsWith('DELETE')) {
        return handleDelete(cleanSql, params);
      }
      return { changes: 0 };
    },
  };
}

function parseConditions(whereClause) {
  const conditions = [];
  let paramCount = 0;
  const parts = whereClause.split(/\s+AND\s+/i);
  
  for (const part of parts) {
    const likeMatch = part.match(/(\w+)\s+LIKE\s+\?/i);
    const eqParamMatch = part.match(/(\w+)\s*=\s*\?/i);
    const eqLiteralMatch = part.match(/(\w+)\s*=\s*'([^']*)'/i);
    const inMatch = part.match(/(\w+)\s+IN\s*\(([^)]+)\)/i);
    
    if (likeMatch) {
      conditions.push({ field: likeMatch[1], op: 'LIKE', paramIndex: paramCount++ });
    } else if (eqParamMatch) {
      conditions.push({ field: eqParamMatch[1], op: '=', paramIndex: paramCount++ });
    } else if (eqLiteralMatch) {
      conditions.push({ field: eqLiteralMatch[1], op: '=', literalValue: eqLiteralMatch[2] });
    }
  }
  
  return conditions;
}

function matchConditions(item, conditions, params) {
  let paramIndex = 0;
  
  for (const cond of conditions) {
    let value;
    
    if (cond.literalValue !== undefined) {
      value = cond.literalValue;
    } else {
      value = params[paramIndex++];
    }
    
    if (cond.op === '=') {
      if (item[cond.field] !== value) return false;
    } else if (cond.op === 'LIKE') {
      const pattern = value.replace(/%/g, '.*');
      const regex = new RegExp(`^${pattern}$`, 'i');
      if (!regex.test(item[cond.field] || '')) return false;
    }
  }
  return true;
}

function handleInsert(sql, params) {
  const tableMatch = sql.match(/INTO\s+(\w+)/i);
  const fieldsMatch = sql.match(/\(([^)]+)\)/);
  const valuesMatch = sql.match(/VALUES\s*\(([^)]+)\)/i);
  
  if (!tableMatch || !fieldsMatch || !valuesMatch) {
    return { changes: 0 };
  }
  
  const table = tableMatch[1];
  const fields = fieldsMatch[1].split(',').map(s => s.trim());
  const values = valuesMatch[1].split(',').map(s => s.trim());
  
  const newRecord = {};
  let paramIndex = 0;
  
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    const value = values[i].trim();
    
    if (value === '?') {
      newRecord[field] = params[paramIndex++];
    } else if (value.toUpperCase() === 'CURRENT_TIMESTAMP') {
      newRecord[field] = new Date().toISOString();
    } else if (value.startsWith("'") && value.endsWith("'")) {
      newRecord[field] = value.slice(1, -1);
    } else {
      newRecord[field] = value;
    }
  }
  
  if (!newRecord.id && db[table]) {
    newRecord.id = uuidv4();
  }
  
  if (!db[table]) {
    db[table] = [];
  }
  
  db[table].push(newRecord);
  saveDb();
  
  return { changes: 1, lastInsertRowid: newRecord.id };
}

function handleUpdate(sql, params) {
  const tableMatch = sql.match(/UPDATE\s+(\w+)/i);
  const setMatch = sql.match(/SET\s+(.+?)\s+WHERE/i);
  const whereMatch = sql.match(/WHERE\s+(.+)$/i);
  
  if (!tableMatch || !setMatch) {
    return { changes: 0 };
  }
  
  const table = tableMatch[1];
  const setClauses = setMatch[1].split(',').map(s => s.trim());
  
  const updates = {};
  let paramIndex = 0;
  
  for (const clause of setClauses) {
    const [field, value] = clause.split('=').map(s => s.trim());
    if (value === '?') {
      updates[field] = params[paramIndex++];
    } else if (value.toUpperCase() === 'CURRENT_TIMESTAMP') {
      updates[field] = new Date().toISOString();
    } else if (value.startsWith("'") && value.endsWith("'")) {
      updates[field] = value.slice(1, -1);
    } else {
      updates[field] = value;
    }
  }
  
  let count = 0;
  
  if (whereMatch) {
    const whereClause = whereMatch[1].trim();
    const conditions = parseConditions(whereClause);
    
    const paramOffset = paramIndex;
    const whereParams = params.slice(paramOffset);
    
    if (db[table]) {
      for (const item of db[table]) {
        if (matchConditions(item, conditions, whereParams)) {
          Object.assign(item, updates);
          count++;
        }
      }
    }
  } else if (db[table]) {
    for (const item of db[table]) {
      Object.assign(item, updates);
      count++;
    }
  }
  
  if (count > 0) saveDb();
  
  return { changes: count };
}

function handleDelete(sql, params) {
  const tableMatch = sql.match(/FROM\s+(\w+)/i);
  const whereMatch = sql.match(/WHERE\s+(.+)$/i);
  
  if (!tableMatch) {
    return { changes: 0 };
  }
  
  const table = tableMatch[1];
  let count = 0;
  
  if (whereMatch && db[table]) {
    const whereClause = whereMatch[1].trim();
    const conditions = parseConditions(whereClause);
    
    const originalLength = db[table].length;
    db[table] = db[table].filter(item => !matchConditions(item, conditions, params));
    count = originalLength - db[table].length;
  } else if (db[table]) {
    count = db[table].length;
    db[table] = [];
  }
  
  if (count > 0) saveDb();
  
  return { changes: count };
}

function exec(sql) {
  const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
  for (const stmt of statements) {
    if (stmt.toUpperCase().startsWith('CREATE TABLE')) {
      const tableMatch = stmt.match(/TABLE\s+IF\s+NOT\s+EXISTS\s+(\w+)/i) || 
                         stmt.match(/TABLE\s+(\w+)/i);
      if (tableMatch && !db[tableMatch[1]]) {
        db[tableMatch[1]] = [];
      }
    } else if (stmt.toUpperCase().startsWith('CREATE INDEX')) {
    }
  }
  saveDb();
}

function logOperation(visitId, action, operator, detail, extraData = {}) {
  const logId = uuidv4();
  const log = {
    id: logId,
    visit_id: visitId,
    action,
    operator,
    detail,
    extra_data: JSON.stringify(extraData),
    created_at: new Date().toISOString(),
  };
  if (!db.operation_logs) {
    db.operation_logs = [];
  }
  db.operation_logs.push(log);
  saveDb();
  return logId;
}

module.exports = {
  prepare,
  exec,
  pragma: () => {},
  logOperation,
  initDatabase,
  get db() { return db; },
};
