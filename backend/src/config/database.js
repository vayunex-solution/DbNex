const mysql = require('mysql2/promise');
const logger = require('../utils/logger');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
  timezone: '+00:00',
  dateStrings: false,
});

/**
 * Execute a query and return rows
 */
const query = async (sql, params = []) => {
  const [rows] = await pool.execute(sql, params);
  return rows;
};

/**
 * Execute an insert/update/delete and return result info
 */
const execute = async (sql, params = []) => {
  const [result] = await pool.execute(sql, params);
  return result;
};

/**
 * Run multiple queries in a transaction
 */
const transaction = async (callback) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await callback(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/**
 * Test connectivity on startup
 */
const testConnection = async () => {
  const conn = await pool.getConnection();
  await conn.ping();
  conn.release();
};

module.exports = { pool, query, execute, transaction, testConnection };
