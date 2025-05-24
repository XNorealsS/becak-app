const express = require('express');
const router = express.Router();
const rideController = require('../controllers/rideController');

// Existing routes
router.post('/request', rideController.requestRide);
router.put('/:id/status', rideController.updateRideStatus);
router.get('/', rideController.getAllRides);
router.get('/driver/:driver_id', rideController.getRidesByDriver);
router.get('/passenger/:passenger_id', rideController.getRidesByPassenger);

// New driver-specific routes
router.get('/available', rideController.getAvailableRides);
router.post('/:id/accept', rideController.acceptRide);

module.exports = router;