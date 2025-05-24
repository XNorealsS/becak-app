const Ride = require('../models/Ride');
const Driver = require('../models/Driver'); // sesuaikan path

// Di dalam fungsi acceptRide


const axios = require('axios');

// Kalkulasi harga ride
const calculateRidePrice = (distanceKm) => {
  const baseRate = 2000;
  const minimum = 7000;
  const estimatedPrice = distanceKm * baseRate;
  const totalPrice = Math.max(estimatedPrice, minimum);
  const appFee = Math.floor(totalPrice * 0.1);
  return { totalPrice, appFee };
};

// Reverse geocoding dengan Nominatim
async function getAddressFromCoordinates(lat, lon) {
  lat = Number(lat);
  lon = Number(lon);
  if (isNaN(lat) || isNaN(lon)) return 'Alamat tidak ditemukan';

  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=id`;
  try {
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'RideApp/1.0 (admin@becakapp.com)' }
    });
    const address = response.data.display_name || 'Alamat tidak ditemukan';

    if (!address.includes('Lhokseumawe') && !address.includes('Aceh Utara')) {
      return 'Di luar area layanan';
    }

    return address;
  } catch (error) {
    console.error('❌ Gagal reverse geocoding:', error.message);
    return 'Alamat tidak ditemukan';
  }
}

// Request Ride
exports.requestRide = async (req, res) => {
  try {
    const { passenger_id, pickup_location, dropoff_location, distance_km } = req.body;

    if (
      !pickup_location || !dropoff_location ||
      pickup_location.latitude == null || pickup_location.longitude == null ||
      dropoff_location.latitude == null || dropoff_location.longitude == null
    ) {
      return res.status(400).json({ message: 'Pickup dan dropoff (lat, lon) diperlukan' });
    }

    if (!distance_km || isNaN(distance_km) || distance_km <= 0) {
      return res.status(400).json({ message: 'Distance (km) harus valid dan positif' });
    }

    const pickupLat = Number(pickup_location.latitude);
    const pickupLon = Number(pickup_location.longitude);
    const dropoffLat = Number(dropoff_location.latitude);
    const dropoffLon = Number(dropoff_location.longitude);

    const pickupAddress = await getAddressFromCoordinates(pickupLat, pickupLon);
    const dropoffAddress = await getAddressFromCoordinates(dropoffLat, dropoffLon);

    if (pickupAddress === 'Di luar area layanan' || dropoffAddress === 'Di luar area layanan') {
      return res.status(400).json({ message: 'Pickup/dropoff di luar area layanan (Lhokseumawe / Aceh Utara)' });
    }

    const { totalPrice, appFee } = calculateRidePrice(distance_km);

    const newRide = {
      passenger_id,
      pickup_location: JSON.stringify({ ...pickup_location, address: pickupAddress }),
      dropoff_location: JSON.stringify({ ...dropoff_location, address: dropoffAddress }),
      status: 'requested',
      price: totalPrice,
      app_fee: appFee,
      distance_km
    };

    Ride.create(newRide, (err, result) => {
      if (err) {
        console.error('❌ Error inserting ride:', err.sqlMessage || err.message);
        return res.status(500).json({ message: 'Gagal membuat ride' });
      }

      const io = req.app.get('io');
      const rideId = result.insertId;

      io.emit('new_ride_request', {
        rideId,
        ...newRide,
        pickup_location: JSON.parse(newRide.pickup_location),
        dropoff_location: JSON.parse(newRide.dropoff_location)
      });

      res.status(201).json({
        message: 'Ride berhasil diminta',
        rideId,
        price: totalPrice,
        app_fee: appFee,
        pickup_address: pickupAddress,
        dropoff_address: dropoffAddress
      });
    });
  } catch (error) {
    console.error('❌ Server error:', error);
    res.status(500).json({ message: 'Server error saat request ride' });
  }
};
// Driver accept ride - FIXED VERSION
exports.acceptRide = (req, res) => {
  const { id } = req.params;
  const { driver_id } = req.body;

  console.log('🚗 Accept ride request:', { rideId: id, driver_id });

  if (!driver_id) return res.status(400).json({ message: 'Driver ID diperlukan' });

  Ride.getById(id, async (err, rides) => {
    if (err) {
      console.error('❌ Error getting ride:', err);
      return res.status(500).json({ message: 'Gagal cek ride', error: err.message });
    }
    
    if (!rides.length) {
      console.log('❌ Ride not found:', id);
      return res.status(404).json({ message: 'Ride tidak ditemukan' });
    }

    const ride = rides[0];
    console.log('📍 Found ride:', ride);
    
    if (ride.status !== 'requested') {
      console.log('❌ Ride status is not requested:', ride.status);
      return res.status(400).json({ message: 'Ride sudah tidak tersedia', currentStatus: ride.status });
    }

    // Update ride status dengan improved error handling
    Ride.updateStatus(id, 'accepted', driver_id, async (updateErr, result) => {
      if (updateErr) {
        console.error('❌ Error updating ride status:', updateErr);
        return res.status(500).json({ 
          message: 'Gagal menerima ride', 
          error: updateErr.message,
          details: 'Database update failed'
        });
      }

      console.log('✅ Ride status updated successfully:', result);

      const io = req.app.get('io');
      if (!io) {
        console.error('❌ Socket.io not available');
        return res.status(500).json({ message: 'Socket connection not available' });
      }

      try {
        // Get driver data dengan multiple fallback methods
        console.log('🔍 Fetching driver data for driver_id:', driver_id);
        
        let driver = null;
        let driverError = null;
        
        // Method 1: getByUserId
        try {
          if (Driver.getByUserId) {
            driver = await Driver.getByUserId(driver_id);
            console.log('✅ Driver found by getByUserId:', driver);
          }
        } catch (userErr) {
          console.log('⚠️ getByUserId failed:', userErr.message);
          driverError = userErr;
        }
        
        // Method 2: getById (jika method 1 gagal)
        if (!driver) {
          try {
            if (Driver.getById) {
              driver = await Driver.getById(driver_id);
              console.log('✅ Driver found by getById:', driver);
            }
          } catch (idErr) {
            console.log('⚠️ getById failed:', idErr.message);
            driverError = idErr;
          }
        }

        // Method 3: Direct query (jika kedua method di atas gagal)
        if (!driver) {
          try {
            // Assuming you have a direct query method
            const query = 'SELECT * FROM drivers WHERE id = ? OR user_id = ?';
            // You'll need to implement this based on your database setup
            console.log('🔍 Trying direct query for driver_id:', driver_id);
          } catch (queryErr) {
            console.log('⚠️ Direct query failed:', queryErr.message);
            driverError = queryErr;
          }
        }

        // Parse location data dengan safe parsing
        let parsedPickupLocation, parsedDropoffLocation;
        
        try {
          if (typeof ride.pickup_location === 'string') {
            parsedPickupLocation = JSON.parse(ride.pickup_location);
          } else {
            parsedPickupLocation = ride.pickup_location;
          }
        } catch (parseErr) {
          console.error('❌ Failed to parse pickup_location:', parseErr);
          parsedPickupLocation = ride.pickup_location || {};
        }
        
        try {
          if (typeof ride.dropoff_location === 'string') {
            parsedDropoffLocation = JSON.parse(ride.dropoff_location);
          } else {
            parsedDropoffLocation = ride.dropoff_location;
          }
        } catch (parseErr) {
          console.error('❌ Failed to parse dropoff_location:', parseErr);
          parsedDropoffLocation = ride.dropoff_location || {};
        }

        const passengerId = ride.passenger_id;
        console.log('📱 Sending notification to passenger:', passengerId);

        // Prepare data untuk dikirim
        const rideAcceptedData = {
          rideId: id,
          driver_id,
          status: 'accepted',
          driver: driver ? {
            id: driver.driver_id || driver.id,
            name: driver.name || 'Driver',
            phone: driver.phone || '',
            vehicle: driver.vehicle || 'Motor',
            plate_number: driver.plate_number || '',
            rating: driver.rating || 5,
            photo: driver.photo || null
          } : {
            id: driver_id,
            name: 'Driver',
            phone: '',
            vehicle: 'Motor',
            plate_number: '',
            rating: 5,
            photo: null
          }
        };

        const navigationData = {
          rideId: id,
          ride: {
            ...ride,
            id: ride.id || id,
            pickup_location: parsedPickupLocation,
            dropoff_location: parsedDropoffLocation,
            passenger_id: passengerId,
            driver_id: driver_id,
            status: 'accepted',
            price: ride.price,
            distance_km: ride.distance_km
          }
        };

        // Emit events
        console.log('🚀 Emitting to passenger:', `passenger_${passengerId}`);
        io.to(`passenger_${passengerId}`).emit('ride_accepted', rideAcceptedData);
        
        console.log('🚀 Emitting to driver:', `driver_${driver_id}`);
        io.to(`driver_${driver_id}`).emit('ride_accepted_start_navigation', navigationData);
        
        // Broadcast ke semua driver lain bahwa ride sudah tidak tersedia
        console.log('🚀 Broadcasting ride no longer available');
        io.emit('ride_no_longer_available', { rideId: id });

        console.log('✅ Ride accepted successfully - all notifications sent');
        
        res.json({ 
          success: true,
          message: 'Ride diterima berhasil', 
          rideId: id,
          driver: rideAcceptedData.driver,
          ride: navigationData.ride,
          driverDataAvailable: !!driver,
          driverError: driverError ? driverError.message : null
        });

      } catch (socketError) {
        console.error('❌ Socket/notification error:', socketError);
        
        // Meskipun ada error socket, ride sudah di-update di database
        // Jadi tetap return success tapi dengan warning
        res.json({ 
          success: true,
          message: 'Ride diterima, tapi ada masalah notifikasi', 
          rideId: id,
          warning: 'Notification may not be sent properly',
          error: socketError.message
        });
      }
    });
  });
};

// Driver update status ride
exports.updateRideStatus = (req, res) => {
  const { id } = req.params;
  const { status, driver_id } = req.body;

  const validStatuses = ['accepted', 'picked_up', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: 'Status tidak valid' });
  }

  Ride.updateStatus(id, status, driver_id, (err) => {
    if (err) return res.status(500).json({ message: 'Gagal update status ride' });

    const io = req.app.get('io');
    io.emit('ride_status_updated', { id, status, driver_id });

    if (driver_id) {
      io.to(`driver_${driver_id}`).emit('ride_status_updated', { id, status });
    }

    res.json({ message: `Status ride diupdate ke ${status}` });
  });
};

// Ambil ride yang tersedia
exports.getAvailableRides = (req, res) => {
  Ride.getByStatus('requested', (err, results) => {
    if (err) return res.status(500).json({ message: 'Gagal ambil ride' });

    try {
      const rides = results.map(r => ({
        ...r,
        pickup_location: JSON.parse(r.pickup_location || '{}'),
        dropoff_location: JSON.parse(r.dropoff_location || '{}')
      }));
      res.json(rides);
    } catch (e) {
      console.error('Parsing error:', e);
      res.status(500).json({ message: 'Gagal parsing data lokasi' });
    }
  });
};

// Semua ride
exports.getAllRides = (req, res) => {
  Ride.getAll((err, results) => {
    if (err) return res.status(500).json({ message: 'Gagal ambil semua ride' });
    res.json(results);
  });
};

// Berdasarkan driver
exports.getRidesByDriver = (req, res) => {
  const { driver_id } = req.params;
  Ride.getByDriver(driver_id, (err, results) => {
    if (err) return res.status(500).json({ message: 'Gagal ambil ride driver' });
    res.json(results);
  });
};

// Berdasarkan penumpang
exports.getRidesByPassenger = (req, res) => {
  const { passenger_id } = req.params;
  Ride.getByPassenger(passenger_id, (err, results) => {
    if (err) return res.status(500).json({ message: 'Gagal ambil ride passenger' });
    res.json(results);
  });
};
