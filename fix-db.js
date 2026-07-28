const Database = require('better-sqlite3');
const db = new Database('artifacts/api-server/sqlite.db');
const result = db.prepare('UPDATE attendance SET status = ? WHERE status = ?').run('present', 'late');
console.log('Updated ' + result.changes + ' records to present.');
