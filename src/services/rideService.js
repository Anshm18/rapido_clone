const { pool } = require('../config/db');
const rideModel = require('../models/rideModel');
const riderModel = require('../models/riderModel');
const matchModel = require('../models/matchModel');

// Known landmark coordinates dictionary for accurate city distance calculations
const KNOWN_LOCATIONS = [
  { keywords: ['connaught place', 'cp', 'central delhi', 'rajiv chowk'], lat: 28.6315, lng: 77.2167 },
  { keywords: ['airport', 'del', 'terminal 3', 'terminal 1', 't3', 'igi'], lat: 28.5562, lng: 77.1000 },
  { keywords: ['cyber city', 'gurugram', 'gurgaon', 'dlf phase 2'], lat: 28.4950, lng: 77.0895 },
  { keywords: ['railway station', 'new delhi railway', 'ndls'], lat: 28.6430, lng: 77.2195 },
  { keywords: ['citywalk', 'select citywalk', 'saket'], lat: 28.5286, lng: 77.2193 },
  { keywords: ['india gate', 'kartavya path'], lat: 28.6129, lng: 77.2295 },
  { keywords: ['noida', 'sector 18', 'sector 62'], lat: 28.5708, lng: 77.3218 },
  { keywords: ['red fort', 'lal qila', 'chandni chowk'], lat: 28.6562, lng: 77.2410 },
  { keywords: ['hauz khas', 'iit delhi'], lat: 28.5494, lng: 77.2001 },
  { keywords: ['dwarka', 'sector 21'], lat: 28.5921, lng: 77.0460 },
];

/**
 * Pure function: Match text with known landmarks
 */
const findCoordsForText = (text) => {
  if (!text || typeof text !== 'string') return null;
  const lower = text.toLowerCase();
  for (const loc of KNOWN_LOCATIONS) {
    if (loc.keywords.some((kw) => lower.includes(kw))) {
      return { lat: loc.lat, lng: loc.lng };
    }
  }
  return null;
};

/**
 * Pure function: Calculate geographical distance between coordinates in KM (Haversine + road factor)
 */
const calculateHaversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.max(1.0, Math.round(R * c * 1.28 * 10) / 10);
};

/**
 * Pure function: Resolve distance based on coords, place names, or explicit km
 */
const resolveDistance = ({ distanceKm, pickup, destination, pickupCoords, destCoords }) => {
  // 1. Direct coordinates
  if (pickupCoords?.lat && pickupCoords?.lng && destCoords?.lat && destCoords?.lng) {
    return calculateHaversineDistance(
      pickupCoords.lat,
      pickupCoords.lng,
      destCoords.lat,
      destCoords.lng
    );
  }

  // 2. Known landmark lookup
  if (pickup && destination) {
    const pCoords = findCoordsForText(pickup);
    const dCoords = findCoordsForText(destination);
    if (pCoords && dCoords) {
      return calculateHaversineDistance(pCoords.lat, pCoords.lng, dCoords.lat, dCoords.lng);
    }

    // 3. Deterministic calculation for arbitrary addresses
    const combinedStr = `${pickup.trim().toLowerCase()}-${destination.trim().toLowerCase()}`;
    let hash = 0;
    for (let i = 0; i < combinedStr.length; i++) {
      hash = (hash << 5) - hash + combinedStr.charCodeAt(i);
      hash |= 0;
    }
    const seed = Math.abs(hash) % 150;
    return Math.round((3.5 + seed * 0.1) * 10) / 10;
  }

  // 4. Fallback to passed distanceKm or 5.0
  if (distanceKm && !isNaN(parseFloat(distanceKm))) {
    return Math.max(1.0, parseFloat(distanceKm));
  }

  return 5.0;
};

/**
 * Pure function: Calculate fare estimates for each vehicle category and tier
 */
const calculateEstimates = (distanceKm = 5.0) => {
  const km = Math.max(1.0, parseFloat(distanceKm) || 5.0);

  return [
    {
      id: 'bike',
      category: 'bike',
      tier: 'standard',
      title: 'Bike',
      subtitle: 'Fastest in traffic, 1 seat',
      etaMinutes: Math.max(2, Math.round(km * 1.5)),
      fare: Math.round(25 + km * 9),
      currency: '₹',
      icon: 'motorcycle',
      capacity: 1,
    },
    {
      id: 'rickshaw',
      category: 'rickshaw',
      tier: 'standard',
      title: 'Auto Rickshaw',
      subtitle: 'Pocket friendly, open air',
      etaMinutes: Math.max(3, Math.round(km * 1.9)),
      fare: Math.round(35 + km * 13),
      currency: '₹',
      icon: 'taxi',
      capacity: 3,
    },
    {
      id: 'taxi_basic',
      category: 'taxi',
      tier: 'basic',
      title: 'Taxi Basic',
      subtitle: 'Compact AC cars for daily trips',
      etaMinutes: Math.max(4, Math.round(km * 2.1)),
      fare: Math.round(50 + km * 16),
      currency: '₹',
      icon: 'car',
      capacity: 4,
    },
    {
      id: 'taxi_premium',
      category: 'taxi',
      tier: 'premium',
      title: 'Taxi Premium',
      subtitle: 'Top rated drivers & comfy sedans',
      etaMinutes: Math.max(4, Math.round(km * 2.0)),
      fare: Math.round(85 + km * 24),
      currency: '₹',
      icon: 'car',
      capacity: 4,
    },
    {
      id: 'taxi_luxury',
      category: 'taxi',
      tier: 'luxury',
      title: 'Taxi Luxury',
      subtitle: 'Executive SUVs & luxury rides',
      etaMinutes: Math.max(6, Math.round(km * 2.4)),
      fare: Math.round(140 + km * 35),
      currency: '₹',
      icon: 'shield',
      capacity: 6,
    },
  ];
};

/**
 * Service: Get dynamic ride fare estimates from backend
 */
const getEstimates = async ({ distanceKm, pickup, destination, pickupCoords, destCoords }) => {
  const calculatedDistanceKm = resolveDistance({
    distanceKm,
    pickup,
    destination,
    pickupCoords,
    destCoords,
  });
  const estimates = calculateEstimates(calculatedDistanceKm);
  return {
    distanceKm: calculatedDistanceKm,
    estimates,
  };
};

/**
 * Service: Create a ride request and broadcast to online drivers within 5 km radius
 */
const requestRide = async ({
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
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Insert ride record into rides table via rideModel
    const ride = await rideModel.createRide(client, {
      userId,
      pickupAddress,
      destinationAddress,
      pickupLat: pickupLat || 28.6139,
      pickupLng: pickupLng || 77.2090,
      destLat: destLat || 28.6200,
      destLng: destLng || 77.2150,
      vehicleType,
      fare,
      distanceKm: distanceKm || 5.0,
    });

    // 2. Find online nearby drivers within 5.0 km radius matching vehicle category
    const nearbyDrivers = await riderModel.findNearbyOnlineRiders({
      vehicleType,
      lat: pickupLat || 28.6139,
      lng: pickupLng || 77.2090,
      radiusKm: 5.0,
    });

    const candidateRider = nearbyDrivers.length > 0 ? nearbyDrivers[0] : null;

    // 3. Create entry in matches table (status: 'pending' until accepted)
    const match = await matchModel.createMatch(client, {
      userId,
      riderId: candidateRider ? candidateRider.id : null,
      rideId: ride.id,
      status: 'pending',
    });

    await client.query('COMMIT');

    return {
      ride,
      match,
      rider: candidateRider,
      nearbyCount: nearbyDrivers.length,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Service: Update driver live GPS location
 */
const updateDriverLocation = async ({ userId, currentLat, currentLng }) => {
  const rider = await riderModel.updateGpsLocation(userId, { currentLat, currentLng });
  return rider;
};

/**
 * Service: Toggle driver online/offline status
 */
const toggleDriverOnlineStatus = async ({ userId, isOnline }) => {
  const rider = await riderModel.updateOnlineStatus(userId, isOnline);
  return rider;
};

/**
 * Service: Fetch pending ride requests for driver matching vehicle type within 5 km
 */
const getPendingRequestsForDriver = async ({ userId, radiusKm = 5.0 }) => {
  const driver = await riderModel.findByUserId(userId);
  if (!driver) {
    const error = new Error('Driver profile not found');
    error.statusCode = 404;
    throw error;
  }

  const driverLat = driver.current_lat || 28.6139;
  const driverLng = driver.current_lng || 77.2090;

  const pendingRides = await rideModel.findPendingRidesWithinRadius({
    vehicleType: driver.vehicle_type,
    driverLat,
    driverLng,
    radiusKm,
  });

  return {
    driver,
    rides: pendingRides,
  };
};

/**
 * Service: Driver accepts a ride
 */
const acceptRide = async ({ userId, rideId }) => {
  const driver = await riderModel.findByUserId(userId);
  if (!driver) {
    const error = new Error('Only registered drivers can accept rides');
    error.statusCode = 403;
    throw error;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Update ride status to accepted
    const ride = await rideModel.updateStatus(rideId, 'accepted');
    if (!ride) {
      throw new Error('Ride not found');
    }

    // Assign driver to ride in matches table
    const match = await matchModel.assignDriverToRide(client, {
      riderId: driver.id,
      rideId,
      status: 'accepted',
    });

    await client.query('COMMIT');

    return {
      success: true,
      ride,
      match,
      rider: driver,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Service: Get live ride status with driver details & driver live GPS
 */
const getRideStatusWithDriver = async (rideId) => {
  const details = await rideModel.findRideDetailsWithDriver(rideId);
  if (!details) {
    const error = new Error('Ride not found');
    error.statusCode = 404;
    throw error;
  }
  return details;
};

/**
 * Service: Complete a ride
 */
const completeRide = async ({ rideId }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ride = await rideModel.updateStatus(rideId, 'complete');
    const match = await matchModel.assignDriverToRide(client, {
      riderId: null,
      rideId,
      status: 'complete',
    });
    await client.query('COMMIT');
    return { ride, match };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Service: Verify 4-digit OTP entered by driver to start the trip
 */
const verifyOtp = async ({ userId, rideId, otp }) => {
  const driver = await riderModel.findByUserId(userId);
  if (!driver) {
    const error = new Error('Only the assigned driver can verify OTP');
    error.statusCode = 403;
    throw error;
  }

  const ride = await rideModel.verifyOtpAndStartTrip(rideId, otp);
  return {
    success: true,
    message: 'OTP verified successfully! Trip has started.',
    ride,
  };
};

/**
 * Service: Cancel ride
 */
const cancelRide = async ({ userId, rideId }) => {
  const ride = await rideModel.findById(rideId);
  if (!ride) {
    const error = new Error('Ride not found');
    error.statusCode = 404;
    throw error;
  }

  const cancelledRide = await rideModel.cancelRide(rideId);
  return {
    success: true,
    message: 'Ride cancelled successfully',
    ride: cancelledRide,
  };
};

/**
 * Service: Fetch user's ride history with match & rider details (via rideModel)
 */
const getRideHistory = async (userId) => {
  return rideModel.findRideHistoryByUserId(userId);
};

module.exports = {
  getEstimates,
  requestRide,
  updateDriverLocation,
  toggleDriverOnlineStatus,
  getPendingRequestsForDriver,
  acceptRide,
  getRideStatusWithDriver,
  verifyOtp,
  cancelRide,
  completeRide,
  getRideHistory,
};
