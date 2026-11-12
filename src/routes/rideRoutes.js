const express = require('express');
const router = express.Router();
const rideController = require('../controllers/rideController');
const { protect } = require('../middleware/authMiddleware');

// Ride estimates & booking
router.post('/estimate', rideController.getEstimates);
router.post('/request', protect, rideController.requestRide);
router.get('/history', protect, rideController.getHistory);
router.get('/:rideId/status', protect, rideController.getRideStatus);
router.post('/:rideId/verify-otp', protect, rideController.verifyOtp);
router.post('/:rideId/cancel', protect, rideController.cancelRide);
router.post('/complete', protect, rideController.completeRide);

// Driver / Rider specific endpoints (GPS location, status, incoming requests within 5km, acceptance)
router.post('/driver/location', protect, rideController.updateDriverLocation);
router.post('/driver/status', protect, rideController.toggleDriverStatus);
router.get('/driver/requests', protect, rideController.getDriverRequests);
router.post('/accept', protect, rideController.acceptRide);

module.exports = router;
