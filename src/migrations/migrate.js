const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const fs = require('fs');
const { pool } = require('../config/db');

/**
 * Migration Runner for PostgreSQL
 * Scans SQL migration files, checks schema_migrations tracking table,
 * and runs unapplied migrations sequentially within isolated transactions.
 */
const runMigrations = async () => {
  const client = await pool.connect();

  try {
    console.log('[Migration] Starting database migration process...');

    // 1. Ensure the migration tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Fetch already executed migrations
    const executedRes = await client.query('SELECT name FROM schema_migrations ORDER BY id ASC');
    const executedMigrations = new Set(executedRes.rows.map((row) => row.name));

    // 3. Scan the migrations directory for .sql files
    const migrationsDir = __dirname;
    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    let appliedCount = 0;

    for (const file of files) {
      if (executedMigrations.has(file)) {
        console.log(`[Migration] [SKIP] ${file} (already executed)`);
        continue;
      }

      console.log(`[Migration] [RUNNING] ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      // Execute each migration inside a transaction
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`[Migration] [SUCCESS] ${file} applied successfully.`);
        appliedCount += 1;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[Migration] [ERROR] Failed to execute ${file}. Transaction rolled back.`);
        throw err;
      }
    }

    if (appliedCount === 0) {
      console.log('[Migration] Database is up to date. No new migrations to apply.');
    } else {
      console.log(`[Migration] Successfully applied ${appliedCount} migration(s).`);
    }
  } catch (error) {
    console.error('[Migration Error]', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
};

runMigrations();
