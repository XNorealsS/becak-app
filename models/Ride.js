const db = require('../config/db');

const Ride = {
  create: (rideData, callback) => {
    const query = `
      INSERT INTO rides (passenger_id, pickup_location, dropoff_location, status, price, app_fee, distance_km) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    db.query(query, [
      rideData.passenger_id,
      rideData.pickup_location,
      rideData.dropoff_location,
      rideData.status,
      rideData.price,
      rideData.app_fee,
      rideData.distance_km
    ], callback);
  },

  getAll: (callback) => {
    const query = 'SELECT * FROM rides ORDER BY created_at DESC';
    db.query(query, callback);
  },

  getById: (id, callback) => {
    const query = 'SELECT * FROM rides WHERE id = ?';
    db.query(query, [id], callback);
  },

// rideModel.js
getByStatus: (status, callback) => {
  const query = 'SELECT * FROM rides WHERE status = ?';
  db.query(query, [status], callback);
},

  getByDriver: (driverId, callback) => {
    const query = 'SELECT * FROM rides WHERE driver_id = ? ORDER BY created_at DESC';
    db.query(query, [driverId], callback);
  },

  getByPassenger: (passengerId, callback) => {
    const query = 'SELECT * FROM rides WHERE passenger_id = ? ORDER BY created_at DESC';
    db.query(query, [passengerId], callback);
  },

  updateStatus: (id, status, driverId, callback) => {
    let query, params;
    
    if (driverId) {
      query = 'UPDATE rides SET status = ?, driver_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
      params = [status, driverId, id];
    } else {
      query = 'UPDATE rides SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
      params = [status, id];
    }
    
    db.query(query, params, callback);
  },

  // Additional methods for driver functionality
  getAvailable: (callback) => {
    const query = 'SELECT * FROM rides WHERE status = "requested" ORDER BY created_at ASC';
    db.query(query, callback);
  },

  acceptRide: (id, driverId, callback) => {
    const query = 'UPDATE rides SET status = "accepted", driver_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = "requested"';
    db.query(query, [driverId, id], callback);
  }
};

module.exports = Ride;