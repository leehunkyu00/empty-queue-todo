const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const User = require('../models/User');
const env = require('../config/environment');

const TOKEN_EXPIRY = '7d';

function generateToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
    },
    env.jwtSecret,
    { expiresIn: TOKEN_EXPIRY }
  );
}

function sanitizeUser(user) {
  const data = user.toObject ? user.toObject({ virtuals: true }) : { ...user };
  delete data.passwordHash;
  delete data.__v;
  return data;
}

function createProfileId() {
  return randomUUID().replace(/-/g, '').slice(0, 10);
}

async function register(req, res) {
  try {
    const { email, password, displayName } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ message: 'A user with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const defaultName = displayName || email.split('@')[0];
    const primaryProfile = {
      profileId: createProfileId(),
      name: defaultName,
      role: 'primary',
      avatarColor: '#2563eb',
    };

    const user = await User.create({
      email: email.toLowerCase(),
      displayName: defaultName,
      passwordHash,
      householdMembers: [primaryProfile],
    });

    const token = generateToken(user);

    return res.status(201).json({
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ message: 'Failed to create account' });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user);

    return res.json({
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Failed to login' });
  }
}

async function getProfile(req, res) {
  try {
    const user = await User.findById(req.auth.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json({ user: sanitizeUser(user) });
  } catch (error) {
    console.error('Profile error:', error);
    return res.status(500).json({ message: 'Failed to load profile' });
  }
}

module.exports = {
  register,
  login,
  getProfile,
};
