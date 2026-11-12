const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const { connectDB } = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const rideRoutes = require('./routes/rideRoutes');

const app = express();

// Connect to Database
connectDB();

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[HTTP] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Middleware
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/rides', rideRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Uber Clone PostgreSQL Authentication Server is running',
    timestamp: new Date().toISOString(),
  });
});

// Centralized error handling middleware
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]', err.stack || err.message);
  const status = err.statusCode || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'An unexpected internal server error occurred',
  });
});

const PORT = process.env.PORT || 5000;

// Listen on all network interfaces by default (supports localhost, emulator, and mobile Wi-Fi)
const server = app.listen(PORT, () => {
  console.log(`[Server] Uber Clone Auth Backend running on port ${PORT}`);
  console.log(`[Server] Local URL:   http://localhost:${PORT}/api`);
  console.log(`[Server] Network URL: http://192.168.29.20:${PORT}/api`);
});

module.exports = { app, server };
