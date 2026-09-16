const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'attendance.db');
const db = new Database(dbPath);

const hash = bcrypt.hashSync('admin', 12);

try {
  const existing = db.prepare("SELECT id FROM employees WHERE email = ?").get('admin');
  if (existing) {
    db.prepare("UPDATE employees SET password_hash = ?, role = 'admin', is_active = 1 WHERE email = ?").run(hash, 'admin');
    console.log('Admin user updated. Login: admin / admin');
  } else {
    db.prepare(
      "INSERT INTO employees (name, email, password_hash, employee_code, role, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))"
    ).run('Admin', 'admin', hash, 'ADM-001', 'admin', 1);
    console.log('Admin user created. Login: admin / admin');
  }
} catch(e) {
  console.error('Error:', e.message);
}

db.close();
