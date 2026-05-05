const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
  host:             process.env.DB_HOST || 'localhost',
  user:             process.env.DB_USER || 'root',
  password:         process.env.DB_PASSWORD || '',
  database:         process.env.DB_NAME || 'bayanihan_connect',
  waitForConnections: true,
  connectionLimit:  10,
  queueLimit:       0,
  timezone:         '+08:00',
  charset:          'utf8mb4'
});

const db = pool.promise();

pool.getConnection((err, connection) => {
  if (err) {
    console.error('[DB] Connection failed:', err.message);
    return;
  }
  console.log('[DB] Connected to MySQL — bayanihan_connect');
  connection.release();
});

module.exports = db;
