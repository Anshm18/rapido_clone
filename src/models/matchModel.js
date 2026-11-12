const { pool } = require('../config/db');

/**
 * Model: Create match entry in matches table
 */
const createMatch = async (dbOrClient, { userId, riderId, rideId, status }) => {
  const db = dbOrClient || pool;
  const insertQuery = `
    INSERT INTO matches (user_id, rider_id, ride_id, status)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `;

  const res = await db.query(insertQuery, [
    userId,
    riderId || null,
    rideId,
    status || 'pending',
  ]);

  return res.rows[0];
};

/**
 * Model: Assign driver to ride in matches table
 */
const assignDriverToRide = async (dbOrClient, { riderId, rideId, status = 'accepted' }) => {
  const db = dbOrClient || pool;

  // Check if match already exists for this ride
  const existing = await db.query('SELECT * FROM matches WHERE ride_id = $1 LIMIT 1', [rideId]);
  if (existing.rows.length > 0) {
    const updateQuery = `
      UPDATE matches
      SET rider_id = $1, status = $2, updated_at = CURRENT_TIMESTAMP
      WHERE ride_id = $3
      RETURNING *
    `;
    const res = await db.query(updateQuery, [riderId, status, rideId]);
    return res.rows[0];
  }

  // Otherwise insert match
  const rideRes = await db.query('SELECT user_id FROM rides WHERE id = $1 LIMIT 1', [rideId]);
  const userId = rideRes.rows[0]?.user_id;

  const insertQuery = `
    INSERT INTO matches (user_id, rider_id, ride_id, status)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `;
  const res = await db.query(insertQuery, [userId, riderId, rideId, status]);
  return res.rows[0];
};

/**
 * Model: Find match by ride ID
 */
const findByRideId = async (rideId) => {
  const res = await pool.query('SELECT * FROM matches WHERE ride_id = $1 LIMIT 1', [rideId]);
  return res.rows[0] || null;
};

module.exports = {
  createMatch,
  assignDriverToRide,
  findByRideId,
};
