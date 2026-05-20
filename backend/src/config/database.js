/**
 * ContaFlow — Configuración PostgreSQL
 * Pool de conexiones con reconexión automática
 */

import pg from 'pg';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'contaflow_db',
  user:     process.env.DB_USER     || 'contaflow_user',
  password: process.env.DB_PASSWORD || '',
  max:      parseInt(process.env.DB_POOL_MAX) || 20,
  min:      parseInt(process.env.DB_POOL_MIN) || 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

pool.on('connect', () => logger.debug('🔌 Nueva conexión DB establecida'));
pool.on('error', (err) => logger.error('❌ Error en pool DB:', err));

export const connectDB = async () => {
  const client = await pool.connect();
  logger.info('✅ PostgreSQL conectado correctamente');
  client.release();
};

/**
 * Ejecutar query simple
 */
export const query = async (sql, params = []) => {
  const start = Date.now();
  try {
    const result = await pool.query(sql, params);
    const ms = Date.now() - start;
    if (ms > 1000) logger.warn(`⚠️ Query lenta (${ms}ms): ${sql.slice(0, 80)}...`);
    return result;
  } catch (err) {
    logger.error(`❌ Error query: ${err.message} | SQL: ${sql.slice(0, 100)}`);
    throw err;
  }
};

/**
 * Transacción
 * Uso: await withTransaction(async (client) => { ... })
 */
export const withTransaction = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export default pool;
