const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('sqlite.db', (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('Connected to the SQLite database.');
});

db.run(`UPDATE attendance SET status = 'present' WHERE status = 'late'`, function(err) {
  if (err) {
    return console.error(err.message);
  }
  console.log(`Row(s) updated: ${this.changes}`);
});

db.close();
