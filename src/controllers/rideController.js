const rideService = require('../services/rideService');

/**
 * Controller: Get dynamic fare estimates
 */
const getEstimates = async (req, res) => {
  try {
    const { distanceKm, pickup, destination, pickupCoords, destCoords } = req.body || {};
    const result = await rideService.getEstimates({
      distanceKm,
      pickup,
      destination,
      pickupCoords,
      destCoords,
    });
    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to calculate ride estimates',
    });
  }
};

/**
 * Controller: Request a ride and broadcast to nearby drivers
 */
const requestRide = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      pickupAddress,
      destinationAddress,
      pickupLat,
      pickupLng,
      destLat,
      destLng,
      vehicleType,
      fare,
      distanceKm,
    } = req.body;

    if (!pickupAddress || !destinationAddress || !vehicleType || !fare) {
      return res.status(400).json({
        success: false,
        message: 'Pickup, destination, vehicle tier, and fare are required',
      });
    }

    const result = await rideService.requestRide({
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
    });

    return res.status(201).json({
      success: true,
      message: 'Ride requested successfully',
      ...result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to create ride request',
    });
  }
};

/**
 * Controller: Update driver live GPS location
 */
const updateDriverLocation = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentLat, currentLng } = req.body;

    if (currentLat === undefined || currentLng === undefined) {
      return res.status(400).json({
        success: false,
        message: 'currentLat and currentLng are required',
      });
    }

    const rider = await rideService.updateDriverLocation({
      userId,
      currentLat: parseFloat(currentLat),
      currentLng: parseFloat(currentLng),
    });

    return res.status(200).json({
      success: true,
      message: 'Driver GPS location updated',
      rider,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update driver location',
    });
  }
};

/**
 * Controller: Toggle driver online/offline status
 */
const toggleDriverStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const { isOnline } = req.body;

    const rider = await rideService.toggleDriverOnlineStatus({
      userId,
      isOnline: Boolean(isOnline),
    });

    return res.status(200).json({
      success: true,
      message: `Driver is now ${isOnline ? 'online' : 'offline'}`,
      rider,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update online status',
    });
  }
};

/**
 * Controller: Get incoming ride requests for driver within 5 km radius
 */
const getDriverRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    const radiusKm = req.query.radius ? parseFloat(req.query.radius) : 5.0;

    const result = await rideService.getPendingRequestsForDriver({
      userId,
      radiusKm,
    });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to fetch driver ride requests',
    });
  }
};

/**
 * Controller: Driver accepts a ride
 */
const acceptRide = async (req, res) => {
  try {
    const userId = req.user.id;
    const { rideId } = req.body;

    if (!rideId) {
      return res.status(400).json({
        success: false,
        message: 'rideId is required to accept a ride',
      });
    }

    const result = await rideService.acceptRide({ userId, rideId });

    return res.status(200).json({
      success: true,
      message: 'Ride accepted successfully',
      ...result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to accept ride',
    });
  }
};

/**
 * Controller: Get live ride status with driver details & driver live GPS
 */
const getRideStatus = async (req, res) => {
  try {
    const { rideId } = req.params;
    const details = await rideService.getRideStatusWithDriver(rideId);

    return res.status(200).json({
      success: true,
      ride: details,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to fetch ride status',
    });
  }
};

/**
 * Controller: Complete ride
 */
const completeRide = async (req, res) => {
  try {
    const { rideId } = req.body;
    const result = await rideService.completeRide({ rideId });
    return res.status(200).json({
      success: true,
      message: 'Ride completed successfully',
      ...result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to complete ride',
    });
  }
};

/**
 * Controller: Fetch user ride history
 */
/**
 * Controller: Verify 4-digit OTP to start ride
 */
const verifyOtp = async (req, res) => {
  try {
    const userId = req.user.id;
    const { rideId } = req.params;
    const { otp } = req.body;

    if (!otp) {
      return res.status(400).json({
        success: false,
        message: '4-digit OTP is required',
      });
    }

    const result = await rideService.verifyOtp({
      userId,
      rideId,
      otp,
    });

    return res.status(200).json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'OTP verification failed',
    });
  }
};

/**
 * Controller: Cancel ride
 */
const cancelRide = async (req, res) => {
  try {
    const userId = req.user.id;
    const { rideId } = req.params;

    const result = await rideService.cancelRide({
      userId,
      rideId,
    });

    return res.status(200).json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to cancel ride',
    });
  }
};

const getHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const history = await rideService.getRideHistory(userId);
    return res.status(200).json({
      success: true,
      history,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch ride history',
    });
  }
};

module.exports = {
  getEstimates,
  requestRide,
  updateDriverLocation,
  toggleDriverStatus,
  getDriverRequests,
  acceptRide,
  getRideStatus,
  verifyOtp,
  cancelRide,
  completeRide,
  getHistory,
};
