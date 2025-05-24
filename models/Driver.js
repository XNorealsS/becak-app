const db = require('../config/db.js'); // Sesuaikan path koneksi database kamu

const Driver = {};

// Ambil driver lengkap berdasarkan ID, termasuk data user
Driver.getById = (id) => {
  return new Promise((resolve, reject) => {
    // Pastikan id adalah number dan valid
    if (!id || isNaN(id)) {
      return reject(new Error('Invalid driver ID'));
    }

    const sql = `
      SELECT 
        d.id AS driver_id,
        d.user_id,
        d.vehicle,
        d.plate_number,
        d.rating,
        d.total_trips,
        d.photo,
        d.created_at AS driver_created_at,
        d.updated_at AS driver_updated_at,
        u.id AS user_id,
        u.name,
        u.email,
        u.phone,
        u.role,
        u.status AS user_status,
        u.created_at AS user_created_at,
        u.updated_at AS user_updated_at
      FROM drivers d
      INNER JOIN users u ON d.user_id = u.id
      WHERE d.id = ? AND u.role = 'driver'
    `;
    
    db.query(sql, [parseInt(id)], (err, results) => {
      if (err) {
        console.error('Database error in Driver.getById:', err);
        return reject(err);
      }
      
      if (results.length === 0) {
        console.log(`Driver with ID ${id} not found`);
        return resolve(null);
      }
      
      // Log untuk debugging
      console.log('Driver found:', results[0]);
      resolve(results[0]);
    });
  });
};

// Ambil driver berdasarkan user_id
Driver.getByUserId = (userId) => {
  return new Promise((resolve, reject) => {
    // Pastikan userId adalah number dan valid
    if (!userId || isNaN(userId)) {
      return reject(new Error('Invalid user ID'));
    }

    const sql = `
      SELECT 
        d.id AS driver_id,
        d.user_id,
        d.vehicle,
        d.plate_number,
        d.rating,
        d.total_trips,
        d.photo,
        d.created_at AS driver_created_at,
        d.updated_at AS driver_updated_at,
        u.id AS user_id,
        u.name,
        u.email,
        u.phone,
        u.role,
        u.status AS user_status,
        u.created_at AS user_created_at,
        u.updated_at AS user_updated_at
      FROM drivers d
      INNER JOIN users u ON d.user_id = u.id
      WHERE d.user_id = ? AND u.role = 'driver'
    `;
    
    db.query(sql, [parseInt(userId)], (err, results) => {
      if (err) {
        console.error('Database error in Driver.getByUserId:', err);
        return reject(err);
      }
      
      if (results.length === 0) {
        console.log(`Driver with user_id ${userId} not found`);
        return resolve(null);
      }
      
      // Log untuk debugging
      console.log('Driver found by user_id:', results[0]);
      resolve(results[0]);
    });
  });
};

// Method untuk mendapatkan semua driver
Driver.getAll = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        d.id AS driver_id,
        d.user_id,
        d.vehicle,
        d.plate_number,
        d.rating,
        d.total_trips,
        d.photo,
        d.created_at AS driver_created_at,
        d.updated_at AS driver_updated_at,
        u.id AS user_id,
        u.name,
        u.email,
        u.phone,
        u.role,
        u.status AS user_status,
        u.created_at AS user_created_at,
        u.updated_at AS user_updated_at
      FROM drivers d
      INNER JOIN users u ON d.user_id = u.id
      WHERE u.role = 'driver'
      ORDER BY d.rating DESC
    `;
    
    db.query(sql, (err, results) => {
      if (err) {
        console.error('Database error in Driver.getAll:', err);
        return reject(err);
      }
      
      console.log(`Found ${results.length} drivers`);
      resolve(results);
    });
  });
};

// Method untuk mendapatkan driver yang online saja
Driver.getOnlineDrivers = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        d.id AS driver_id,
        d.user_id,
        d.vehicle,
        d.plate_number,
        d.rating,
        d.total_trips,
        d.photo,
        u.name,
        u.email,
        u.phone,
        u.status AS user_status
      FROM drivers d
      INNER JOIN users u ON d.user_id = u.id
      WHERE u.role = 'driver' AND u.status = 'online'
      ORDER BY d.rating DESC
    `;
    
    db.query(sql, (err, results) => {
      if (err) {
        console.error('Database error in Driver.getOnlineDrivers:', err);
        return reject(err);
      }
      
      resolve(results);
    });
  });
};

// Method untuk update status driver
Driver.updateStatus = (driverId, status) => {
  return new Promise((resolve, reject) => {
    if (!driverId || !status) {
      return reject(new Error('Driver ID and status are required'));
    }

    // Update status di tabel users berdasarkan driver_id
    const sql = `
      UPDATE users u
      INNER JOIN drivers d ON u.id = d.user_id
      SET u.status = ?
      WHERE d.id = ?
    `;
    
    db.query(sql, [status, parseInt(driverId)], (err, results) => {
      if (err) {
        console.error('Database error in Driver.updateStatus:', err);
        return reject(err);
      }
      
      if (results.affectedRows === 0) {
        return reject(new Error('Driver not found'));
      }
      
      resolve(results);
    });
  });
};

module.exports = Driver;