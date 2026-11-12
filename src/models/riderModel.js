const { pool } = require('../config/db');

/**
 * Model: Create driver / rider profile linked to user_id
 */
const createRiderProfile = async ({
  userId,
  name,
  email,
  phone,
  vehicleType,
  vehicleNumber,
  drivingLicense,
  currentLat,
  currentLng,
}) => {
  const query = `
    INSERT INTO riders (
      user_id, name, email, phone, vehicle_type,
      vehicle_number, driving_license, is_online,
      current_lat, current_lng
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $9)
    RETURNING *
  `;

  const res = await pool.query(query, [
    userId,
    name.trim(),
    email.toLowerCase().trim(),
    phone ? phone.trim() : '',
    vehicleType,
    vehicleNumber ? vehicleNumber.trim().toUpperCase() : '',
    drivingLicense ? drivingLicense.trim().toUpperCase() : '',
    currentLat || 28.6139,
    currentLng || 77.2090,
  ]);

  return res.rows[0];
};

/**
 * Model: Find rider by user_id, rider id, or user email (with automatic user_id linking)
 */
const findByUserId = async (userId) => {
  const numericId = parseInt(userId, 10) || userId;
  const query = `
    SELECT r.* 
    FROM riders r
    LEFT JOIN users u ON u.email = r.email
    WHERE r.user_id = $1 
       OR r.id = $1
       OR u.id = $1
    ORDER BY (r.user_id = $1) DESC, r.id ASC
    LIMIT 1
  `;
  const res = await pool.query(query, [numericId]);
  const rider = res.rows[0];
  if (rider && (!rider.user_id || rider.user_id !== numericId)) {
    try {
      await pool.query('UPDATE riders SET user_id = $1 WHERE id = $2', [numericId, rider.id]);
      rider.user_id = numericId;
    } catch (e) {
      console.warn('Auto-link rider user_id notice:', e.message);
    }
  }
  return rider || null;
};

/**
 * Model: Update rider live GPS location
 */
const updateGpsLocation = async (userIdOrRiderId, { currentLat, currentLng }) => {
  const query = `
    UPDATE riders
    SET current_lat = $1, current_lng = $2, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = $3 OR id = $3
    RETURNING *
  `;
  const res = await pool.query(query, [currentLat, currentLng, userIdOrRiderId]);
  return res.rows[0] || null;
};

/**
 * Model: Update rider online status
 */
const updateOnlineStatus = async (userIdOrRiderId, isOnline) => {
  const query = `
    UPDATE riders
    SET is_online = $1, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = $2 OR id = $2
    RETURNING *
  `;
  const res = await pool.query(query, [isOnline, userIdOrRiderId]);
  return res.rows[0] || null;
};

/**
 * Model: Find highest rated available online rider for a vehicle type
 */
const findAvailableRider = async (dbOrClient, { vehicleType }) => {
  const db = dbOrClient || pool;
  const query = `
    SELECT * FROM riders
    WHERE vehicle_type = $1 AND is_online = true
    ORDER BY rating DESC
    LIMIT 1
  `;

  const res = await db.query(query, [vehicleType]);
  return res.rows[0] || null;
};

/**
 * Model: Find online drivers of specific vehicle type within radiusKm of (lat, lng)
 */
const findNearbyOnlineRiders = async ({ vehicleType, lat, lng, radiusKm = 5.0 }) => {
  // Haversine formula distance calculation in KM
  const query = `
    SELECT *,
      (6371 * acos(
        least(1.0, greatest(-1.0, 
          cos(radians($1)) * cos(radians(current_lat)) * cos(radians(current_lng) - radians($2)) + 
          sin(radians($1)) * sin(radians(current_lat))
        ))
      )) AS distance_km
    FROM riders
    WHERE vehicle_type = $3 
      AND is_online = true
      AND current_lat IS NOT NULL
      AND current_lng IS NOT NULL
    GROUP BY id
    HAVING (6371 * acos(
      least(1.0, greatest(-1.0, 
        cos(radians($1)) * cos(radians(current_lat)) * cos(radians(current_lng) - radians($2)) + 
        sin(radians($1)) * sin(radians(current_lat))
      ))
    )) <= $4
    ORDER BY distance_km ASC
  `;

  const res = await pool.query(query, [lat, lng, vehicleType, radiusKm]);
  return res.rows;
};

/**
 * Model: Find rider by ID
 */
const findById = async (riderId) => {
  const res = await pool.query('SELECT * FROM riders WHERE id = $1 LIMIT 1', [riderId]);
  return res.rows[0] || null;
};

module.exports = {
  createRiderProfile,
  findByUserId,
  updateGpsLocation,
  updateOnlineStatus,
  findAvailableRider,
  findNearbyOnlineRiders,
  findById,
};
