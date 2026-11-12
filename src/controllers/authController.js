const authService = require('../services/authService');

/**
 * Controller: Handle User Signup
 */
const signup = async (req, res, next) => {
  try {
    const {
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
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long',
      });
    }

    const result = await authService.registerUser({
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
    });

    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      token: result.token,
      user: result.user,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    console.error(`[Signup Error] ${error.message}`);
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Internal server error during registration',
    });
  }
};

/**
 * Controller: Handle User Login
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    const result = await authService.authenticateUser({ email, password });

    return res.status(200).json({
      success: true,
      message: 'Logged in successfully',
      token: result.token,
      user: result.user,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    console.error(`[Login Error] ${error.message}`);
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Internal server error during login',
    });
  }
};

/**
 * Controller: Handle Google Sign-in / Firebase Sync
 */
const googleAuth = async (req, res, next) => {
  try {
    const { email, name, avatar, googleId } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Google email is required',
      });
    }

    const result = await authService.syncGoogleUser({
      email,
      name,
      avatar,
      googleId,
    });

    return res.status(200).json({
      success: true,
      message: 'Google authentication successful',
      token: result.token,
      user: result.user,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Internal server error during Google authentication',
    });
  }
};

/**
 * Controller: Get authenticated user profile
 */
const getMe = async (req, res, next) => {
  try {
    const user = await authService.getUserById(req.user.id);
    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Error fetching user profile',
    });
  }
};

module.exports = {
  signup,
  login,
  googleAuth,
  getMe,
};

