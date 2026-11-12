const { pool } = require('../config/db');

/**
 * Model: Find user by email
 */
const findByEmail = async (email) => {
  const normalizedEmail = email.toLowerCase().trim();
  const res = await pool.query(
    'SELECT * FROM users WHERE email = $1 LIMIT 1',
    [normalizedEmail]
  );
  return res.rows[0] || null;
};

/**
 * Model: Find user by ID
 */
const findById = async (id) => {
  const res = await pool.query(
    'SELECT id, name, email, google_id, avatar, role, phone, created_at FROM users WHERE id = $1 LIMIT 1',
    [id]
  );
  return res.rows[0] || null;
};

/**
 * Model: Find user by Google ID or Email
 */
const findByGoogleIdOrEmail = async (googleId, email) => {
  const normalizedEmail = email.toLowerCase().trim();
  const res = await pool.query(
    'SELECT * FROM users WHERE (google_id IS NOT NULL AND google_id = $1) OR email = $2 LIMIT 1',
    [googleId || '', normalizedEmail]
  );
  return res.rows[0] || null;
};

/**
 * Model: Create standard user with hashed password
 */
const createUser = async ({ name, email, hashedPassword, phone, role }) => {
  const insertQuery = `
    INSERT INTO users (name, email, password, phone, role)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, name, email, google_id, avatar, role, phone, created_at
  `;

  const res = await pool.query(insertQuery, [
    name.trim(),
    email.toLowerCase().trim(),
    hashedPassword,
    phone ? phone.trim() : '',
    role || 'rider',
  ]);

  return res.rows[0];
};

/**
 * Model: Create user via Google OAuth
 */
const createGoogleUser = async ({ name, email, googleId, avatar, role }) => {
  const insertQuery = `
    INSERT INTO users (name, email, google_id, avatar, role)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, name, email, google_id, avatar, role, phone, created_at
  `;

  const res = await pool.query(insertQuery, [
    name || email.split('@')[0],
    email.toLowerCase().trim(),
    googleId || null,
    avatar || '',
    role || 'rider',
  ]);

  return res.rows[0];
};

/**
 * Model: Update existing user with Google OAuth credentials
 */
const updateGoogleUser = async ({ id, googleId, avatar }) => {
  const updateQuery = `
    UPDATE users
    SET google_id = COALESCE(google_id, $1),
        avatar = CASE WHEN avatar = '' OR avatar IS NULL THEN $2 ELSE avatar END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $3
    RETURNING id, name, email, google_id, avatar, role, phone, created_at
  `;

  const res = await pool.query(updateQuery, [googleId, avatar, id]);
  return res.rows[0];
};

module.exports = {
  findByEmail,
  findById,
  findByGoogleIdOrEmail,
  createUser,
  createGoogleUser,
  updateGoogleUser,
};

