const { pool } = require('../config/db');

/**
 * Model: Insert ride into rides table
 */
const createRide = async (dbOrClient, {
  userId,
  pickupAddress,
  destinationAddress,
  pickupLat,
  pickupLng,
  destLat,
  destLng,
  vehicleType,
  fare,
  distanceKm,
}) => {
  const db = dbOrClient || pool;
  const generatedOtp = String(Math.floor(1000 + Math.random() * 9000));
  const insertQuery = `
    INSERT INTO rides (
      user_id, pickup_address, destination_address,
      pickup_lat, pickup_lng, dest_lat, dest_lng,
      vehicle_type, fare, distance_km, status, otp
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', $11)
    RETURNING *
  `;

  const res = await db.query(insertQuery, [
    userId,
    pickupAddress,
    destinationAddress,
    pickupLat || 28.6139,
    pickupLng || 77.2090,
    destLat || 28.6200,
    destLng || 77.2150,
    vehicleType,
    fare,
    distanceKm || 5.0,
    generatedOtp,
  ]);

  return res.rows[0];
};

/**
 * Model: Find pending ride requests within radiusKm of driver's GPS location matching vehicleType
 */
const findPendingRidesWithinRadius = async ({
  vehicleType,
  driverLat,
  driverLng,
  radiusKm = 5.0,
}) => {
  const query = `
    SELECT 
      r.id,
      r.id AS ride_id,
      r.user_id,
      r.pickup_address,
      r.destination_address,
      r.pickup_lat,
      r.pickup_lng,
      r.dest_lat,
      r.dest_lng,
      r.vehicle_type,
      r.fare,
      r.distance_km,
      r.created_at,
      u.name AS passenger_name,
      u.phone AS passenger_phone,
      ROUND(CAST(6371 * acos(
        least(1.0, greatest(-1.0, 
          cos(radians($1)) * cos(radians(r.pickup_lat)) * cos(radians(r.pickup_lng) - radians($2)) + 
          sin(radians($1)) * sin(radians(r.pickup_lat))
        ))
      ) AS numeric), 1) AS distance_to_pickup_km
    FROM rides r
    JOIN users u ON u.id = r.user_id
    WHERE r.status = 'pending'
      AND r.vehicle_type = $3
      AND r.pickup_lat IS NOT NULL
      AND r.pickup_lng IS NOT NULL
    GROUP BY r.id, u.id
    HAVING (6371 * acos(
      least(1.0, greatest(-1.0, 
        cos(radians($1)) * cos(radians(r.pickup_lat)) * cos(radians(r.pickup_lng) - radians($2)) + 
        sin(radians($1)) * sin(radians(r.pickup_lat))
      ))
    )) <= $4
    ORDER BY distance_to_pickup_km ASC, r.created_at DESC
    LIMIT 20
  `;

  const res = await pool.query(query, [driverLat, driverLng, vehicleType, radiusKm]);
  return res.rows;
};

/**
 * Model: Update ride status
 */
const updateStatus = async (rideId, status) => {
  const query = `
    UPDATE rides
    SET status = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *
  `;
  const res = await pool.query(query, [status, rideId]);
  return res.rows[0] || null;
};

/**
 * Model: Find ride by ID
 */
const findById = async (rideId) => {
  const res = await pool.query('SELECT * FROM rides WHERE id = $1 LIMIT 1', [rideId]);
  return res.rows[0] || null;
};

/**
 * Model: Find ride with live driver details and driver live GPS coordinates
 */
const findRideDetailsWithDriver = async (rideId) => {
  const query = `
    SELECT 
      r.id,
      r.id AS ride_id,
      r.user_id,
      r.pickup_address,
      r.destination_address,
      r.pickup_lat,
      r.pickup_lng,
      r.dest_lat,
      r.dest_lng,
      r.vehicle_type,
      r.fare,
      r.distance_km,
      r.status,
      r.otp,
      r.started_at,
      r.completed_at,
      r.created_at,
      m.id AS match_id,
      m.status AS match_status,
      rd.id AS rider_id,
      COALESCE(rd.name, ru.name) AS rider_name,
      COALESCE(rd.phone, ru.phone) AS rider_phone,
      rd.vehicle_number,
      rd.vehicle_type AS rider_vehicle_type,
      rd.rating AS rider_rating,
      rd.current_lat AS driver_lat,
      rd.current_lng AS driver_lng,
      rd.is_online AS driver_is_online
    FROM rides r
    LEFT JOIN matches m ON m.ride_id = r.id
    LEFT JOIN riders rd ON rd.id = m.rider_id
    LEFT JOIN users ru ON ru.id = rd.user_id
    WHERE r.id = $1
    ORDER BY m.updated_at DESC NULLS LAST
    LIMIT 1
  `;

  const res = await pool.query(query, [rideId]);
  return res.rows[0] || null;
};

/**
 * Model: Verify 4-digit OTP and transition ride to in_progress
 */
const verifyOtpAndStartTrip = async (rideId, enteredOtp) => {
  const ride = await findById(rideId);
  if (!ride) {
    const error = new Error('Ride not found');
    error.statusCode = 404;
    throw error;
  }

  if (ride.otp && String(ride.otp).trim() !== String(enteredOtp).trim()) {
    const error = new Error('Invalid OTP! Please ask passenger for the 4-digit verification code.');
    error.statusCode = 400;
    throw error;
  }

  const query = `
    UPDATE rides
    SET status = 'in_progress', started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *
  `;
  const res = await pool.query(query, [rideId]);

  await pool.query(
    "UPDATE matches SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP WHERE ride_id = $1",
    [rideId]
  );

  return res.rows[0];
};

/**
 * Model: Cancel ride
 */
const cancelRide = async (rideId) => {
  const query = `
    UPDATE rides
    SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *
  `;
  const res = await pool.query(query, [rideId]);

  await pool.query(
    "UPDATE matches SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE ride_id = $1",
    [rideId]
  );

  return res.rows[0] || null;
};

/**
 * Model: Fetch full ride history for user or driver with match & passenger details
 */
const findRideHistoryByUserId = async (userId, limit = 50) => {
  const numericUserId = parseInt(userId, 10) || userId;
  const query = `
    WITH matched_rides AS (
      SELECT DISTINCT ON (r.id)
        r.id AS ride_id,
        r.pickup_address,
        r.destination_address,
        r.vehicle_type,
        r.fare,
        r.distance_km,
        r.status,
        r.otp,
        r.created_at,
        r.started_at,
        r.completed_at,
        m.id AS match_id,
        m.status AS match_status,
        COALESCE(rd.name, ru.name, 'Captain') AS rider_name,
        COALESCE(rd.phone, ru.phone, '') AS rider_phone,
        rd.vehicle_number,
        rd.rating AS rider_rating,
        COALESCE(u.name, 'Passenger') AS passenger_name,
        COALESCE(u.phone, '') AS passenger_phone
      FROM rides r
      LEFT JOIN users u ON u.id = r.user_id
      LEFT JOIN matches m ON m.ride_id = r.id
      LEFT JOIN riders rd ON rd.id = m.rider_id
      LEFT JOIN users ru ON ru.id = rd.user_id
      WHERE r.user_id = $1
         OR rd.user_id = $1
         OR rd.id = $1
         OR m.rider_id = $1
         OR m.rider_id IN (
              SELECT id FROM riders 
              WHERE user_id = $1 
                 OR email = (SELECT email FROM users WHERE id = $1 LIMIT 1)
            )
         OR rd.email = (SELECT email FROM users WHERE id = $1 LIMIT 1)
      ORDER BY r.id, m.updated_at DESC NULLS LAST, m.created_at DESC NULLS LAST
    )
    SELECT * FROM matched_rides
    ORDER BY created_at DESC
    LIMIT $2
  `;

  const res = await pool.query(query, [numericUserId, limit]);
  return res.rows;
};

module.exports = {
  createRide,
  findPendingRidesWithinRadius,
  updateStatus,
  findById,
  findRideDetailsWithDriver,
  verifyOtpAndStartTrip,
  cancelRide,
  findRideHistoryByUserId,
};
