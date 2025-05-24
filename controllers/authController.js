const bcrypt = require('bcryptjs');
const User = require('../models/User');
const generateToken = require('../utils/jwt');

// ✅ REGISTER
exports.register = async (req, res) => {
  try {
    const { name, email, password, phone, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    User.findByEmail(email, async (err, results) => {
      if (err) {
        console.error('[DB Error]:', err);
        return res.status(500).json({ message: 'Database error' });
      }

      if (results.length > 0) {
        return res.status(400).json({ message: 'Email already registered' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = { name, email, password: hashedPassword, phone, role };

      User.create(newUser, (err, result) => {
        if (err) {
          console.error('[User Creation Error]:', err);
          return res.status(500).json({ message: 'User creation failed' });
        }

        res.status(201).json({ message: 'User registered successfully' });
      });
    });
  } catch (error) {
    console.error('[Register Error]:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ✅ LOGIN
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('🟡 Login attempt for:', email);

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    User.findByEmail(email, async (err, results) => {
      if (err) {
        console.error('[DB Error]:', err);
        return res.status(500).json({ message: 'Database error' });
      }

      if (results.length === 0) {
        console.warn('❌ User not found:', email);
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      const user = results[0];
      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        console.warn('❌ Wrong password for:', email);
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      const token = generateToken(user);

      const response = {
        message: 'Login successful',
        token,
        role: user.role,
        user_id: user.id,
        email: user.email,
      };

      if (user.role === 'driver') {
        response.driver_id = user.id;
      }

      console.log('✅ Login successful:', email);
      res.status(200).json(response);
    });
  } catch (error) {
    console.error('[Login Error]:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
