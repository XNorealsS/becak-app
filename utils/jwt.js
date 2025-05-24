// utils/jwt.js
const jwt = require('jsonwebtoken');
const secret = process.env.JWT_SECRET || 'default_secret';

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    secret,
    { expiresIn: '7d' }
  );
};

module.exports = generateToken;
