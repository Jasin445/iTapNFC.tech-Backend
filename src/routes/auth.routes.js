const express = require('express');
const rateLimit = require('express-rate-limit');
const requireAuth = require('../middleware/auth');
const {
  register,
  login,
  me,
  forgotPassword,
  resetPassword,
  inAppPasswordReset,
} = require('../controllers/auth.controller');

const router = express.Router();

// Slow down brute-force attempts on login/register/password-reset
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: 'Too many attempts. Please try again later.' },
});

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);
router.post('/change-password', authLimiter, requireAuth, inAppPasswordReset);
router.get('/me', requireAuth, me);

module.exports = router;
