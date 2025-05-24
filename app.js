const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: '*' }
});

app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));

const authRoutes = require('./routes/authRoutes');
const rideRoutes = require('./routes/rideRoutes');

// Middleware
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/rides', rideRoutes);

// Helper Function
async function getPassengerIdFromRide(rideId) {
  return new Promise((resolve, reject) => {
    const Ride = require('./models/Ride');
    Ride.getById(rideId, (err, results) => {
      if (err || !results.length) {
        return reject(err || new Error('Ride tidak ditemukan'));
      }
      resolve(results[0].passenger_id);
    });
  });
}

// Socket.IO listeners
io.on('connection', (socket) => {
  socket.on('join_room', (roomName) => {
    socket.join(roomName);
    console.log(`🔗 Socket ${socket.id} join room: ${roomName}`);
  });

  // Terima update status dari driver
  socket.on("driver_ride_status_update", (data) => {
    const { rideId, driverId, status } = data;

    getPassengerIdFromRide(rideId)
      .then(userId => {
        if (userId) {
          io.to(`passenger_${userId}`).emit("ride_status_updated", {
            rideId,
            status
          });
        }
      })
      .catch(err => {
        console.error('Error getting passenger ID:', err);
      });
  });

  socket.on('disconnect', () => {
    console.log(`❌ Socket ${socket.id} disconnected`);
  });
});

// Expose io globally
app.set('io', io);

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});