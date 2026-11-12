const path = require('path');
const dns = require('dns');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const pg = require('pg');
const { Pool, types } = pg;

// Parse PostgreSQL NUMERIC/DECIMAL (OID 1700) as JS floating-point numbers instead of strings
types.setTypeParser(1700, (val) => (val === null ? null : parseFloat(val)));

/**
 * Robust DNS Resolution Layer:
 * Some local ISP routers (e.g. Jio/Airtel gateway 192.168.29.1) refuse DNS queries (RCODE_REFUSED)
 * for AWS / Cloud endpoints such as *.neon.tech. We install a transparent fallback hook on dns.lookup
 * so that if standard OS getaddrinfo resolution fails, it queries trusted public resolvers (8.8.8.8, 1.1.1.1).
 */
const fallbackDnsServers = (process.env.FALLBACK_DNS_SERVERS || '8.8.8.8,1.1.1.1')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const resolver = new dns.Resolver();
resolver.setServers(fallbackDnsServers);

const origLookup = dns.lookup;
dns.lookup = function (hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  origLookup(hostname, options, (err, address, family) => {
    if (err && hostname && !hostname.startsWith('localhost') && hostname !== '127.0.0.1') {
      return resolver.resolve4(hostname, (resolveErr, addrs) => {
        if (resolveErr || !addrs || addrs.length === 0) {
          return callback(err);
        }
        if (options && options.all) {
          return callback(
            null,
            addrs.map((a) => ({ address: a, family: 4 }))
          );
        }
        return callback(null, addrs[0], 4);
      });
    }
    return callback(err, address, family);
  });
};

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

const isProductionOrCloud =
  process.env.NODE_ENV === 'production' ||
  (databaseUrl &&
    (databaseUrl.includes('neon.tech') ||
      databaseUrl.includes('supabase.co') ||
      databaseUrl.includes('render.com') ||
      databaseUrl.includes('railway.app') ||
      databaseUrl.includes('sslmode=require')));

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: isProductionOrCloud ? { rejectUnauthorized: false } : false,
});

/**
 * Verifies connection to the PostgreSQL database without running any DDL/schema modifications.
 * Table creation and alterations are handled exclusively via migration files.
 */
const connectDB = async () => {
  try {
    const client = await pool.connect();
    const res = await client.query('SELECT NOW() AS current_time');
    console.log(`[Database] PostgreSQL Connected successfully at ${res.rows[0].current_time}`);
    client.release();
    return pool;
  } catch (error) {
    console.error(`[Database Error] Connection failed: ${error.message}`);
    return null;
  }
};

module.exports = {
  pool,
  connectDB,
};
