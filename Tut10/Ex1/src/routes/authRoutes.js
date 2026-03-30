const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// POST /api/v1/auth/register [cite: 83-85]
router.post('/register', authController.register);

// GET /api/v1/auth/verify/YOUR_TOKEN_HERE
router.get('/verify/:token', authController.verifyEmail);

// POST /api/v1/auth/login
router.post('/login', authController.login);

// POST /api/v1/auth/logout (requires authentication)
router.post('/logout', protect, authController.logout);

// POST /api/v1/auth/forgot-password
router.post('/forgot-password', authController.forgotPassword);

// POST /api/v1/auth/reset-password/:token
router.post('/reset-password/:token', authController.resetPassword);

module.exports = router;