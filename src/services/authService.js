const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');
const riderModel = require('../models/riderModel');

const getJwtSecret = () => process.env.JWT_SECRET || 'dev_jwt_secret_change_in_prod';
const getJwtExpiresIn = () => process.env.JWT_EXPIRES_IN || '7d';

/**
 * Pure function: Generate JWT token
 */
const generateToken = (userId, role) => {
  return jwt.sign({ id: userId, role }, getJwtSecret(), {
    expiresIn: getJwtExpiresIn(),
  });
};

/**
 * Pure function: Format raw database user row to client format
 */
const formatUserResponse = (row, riderProfile = null) => {
  if (!row) return null;
  const { password, ...safeUser } = row;
  return {
    id: safeUser.id,
    name: safeUser.name,
    email: safeUser.email,
    googleId: safeUser.google_id || null,
    avatar: safeUser.avatar || '',
    role: safeUser.role || 'user',
    phone: safeUser.phone || '',
    createdAt: safeUser.created_at,
    riderProfile: riderProfile || safeUser.riderProfile || undefined,
  };
};

/**
 * Hash raw password
 */
const hashPassword = async (password) => {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
};

/**
 * Verify password against hashed password
 */
const verifyPassword = async (plainPassword, hashedPassword) => {
  return bcrypt.compare(plainPassword, hashedPassword);
};

/**
 * Service: Register new user or driver in PostgreSQL
 */
const registerUser = async ({
  name,
  email,
  password,
  phone,
  role,
  vehicleType,
  vehicleNumber,
  drivingLicense,
  currentLat,
  currentLng,
}) => {
  const normalizedEmail = email.toLowerCase().trim();
  const assignedRole = role === 'rider' ? 'rider' : 'user';

  if (assignedRole === 'rider') {
    if (!vehicleType || !vehicleNumber || !drivingLicense) {
      const error = new Error(
        'Vehicle category, vehicle number, and driving license are required for rider/driver registration'
      );
      error.statusCode = 400;
      throw error;
    }
  }

  const existingUser = await userModel.findByEmail(normalizedEmail);
  if (existingUser) {
    const error = new Error('An account with this email already exists');
    error.statusCode = 400;
    throw error;
  }

  const hashedPassword = await hashPassword(password);
  const newUser = await userModel.createUser({
    name,
    email: normalizedEmail,
    hashedPassword,
    phone,
    role: assignedRole,
  });

  let riderProfile = null;
  if (assignedRole === 'rider') {
    riderProfile = await riderModel.createRiderProfile({
      userId: newUser.id,
      name,
      email: normalizedEmail,
      phone,
      vehicleType,
      vehicleNumber,
      drivingLicense,
      currentLat,
      currentLng,
    });
  }

  const token = generateToken(newUser.id, newUser.role);

  return {
    token,
    user: formatUserResponse(newUser, riderProfile),
  };
};

/**
 * Service: Authenticate user with Email & Password in PostgreSQL
 */
const authenticateUser = async ({ email, password }) => {
  const normalizedEmail = email.toLowerCase().trim();

  const user = await userModel.findByEmail(normalizedEmail);
  if (!user) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  if (!user.password) {
    const error = new Error('Please sign in using Google for this account');
    error.statusCode = 400;
    throw error;
  }

  const isMatch = await verifyPassword(password, user.password);
  if (!isMatch) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  let riderProfile = null;
  if (user.role === 'rider') {
    riderProfile = await riderModel.findByUserId(user.id);
  }

  const token = generateToken(user.id, user.role);

  return {
    token,
    user: formatUserResponse(user, riderProfile),
  };
};

/**
 * Service: Find or create user via Google OAuth in PostgreSQL
 */
const syncGoogleUser = async ({ email, name, avatar, googleId }) => {
  const normalizedEmail = email.toLowerCase().trim();

  const existing = await userModel.findByGoogleIdOrEmail(googleId, normalizedEmail);

  let user;
  if (existing) {
    user = await userModel.updateGoogleUser({
      id: existing.id,
      googleId: googleId || existing.google_id,
      avatar: avatar || existing.avatar,
    });
  } else {
    user = await userModel.createGoogleUser({
      name,
      email: normalizedEmail,
      googleId,
      avatar,
      role: 'user',
    });
  }

  let riderProfile = null;
  if (user.role === 'rider') {
    riderProfile = await riderModel.findByUserId(user.id);
  }

  const token = generateToken(user.id, user.role);

  return {
    token,
    user: formatUserResponse(user, riderProfile),
  };
};

/**
 * Service: Get user by ID from PostgreSQL
 */
const getUserById = async (userId) => {
  const user = await userModel.findById(userId);

  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  let riderProfile = null;
  if (user.role === 'rider') {
    riderProfile = await riderModel.findByUserId(user.id);
  }

  return formatUserResponse(user, riderProfile);
};

module.exports = {
  generateToken,
  formatUserResponse,
  registerUser,
  authenticateUser,
  syncGoogleUser,
  getUserById,
};
