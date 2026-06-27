const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../config/db');
const { signToken } = require('../utils/jwt');
const asyncHandler = require('../utils/asyncHandler');

// POST /api/auth/register
const register = asyncHandler(async (req, res) => {
  const { name, businessName, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email and password are required.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters.' });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ message: 'An account with this email already exists.' });
  }

  const hashed = await bcrypt.hash(password, 10);
  const starterPlan = await prisma.plan.findUnique({ where: { tier: 'STARTER' } });

  const user = await prisma.user.create({
    data: {
      name,
      businessName,
      email,
      password: hashed,
      subscription: starterPlan
        ? {
            create: {
              planId: starterPlan.id,
              status: 'TRIALING',
              renewsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14-day trial
            },
          }
        : undefined,
    },
  });

  const token = signToken({ id: user.id, role: user.role });

  res.status(201).json({
    token,
    user: { id: user.id, name: user.name, email: user.email, businessName: user.businessName, role: user.role },
  });
});

// POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  const matches = await bcrypt.compare(password, user.password);
  if (!matches) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }
  if (user.status === 'SUSPENDED') {
    return res.status(403).json({ message: 'This account has been suspended. Contact support.' });
  }

  const token = signToken({ id: user.id, role: user.role });

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, businessName: user.businessName, role: user.role },
  });
});

// GET /api/auth/me
const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/forgot-password
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });

  // Always respond the same way whether or not the user exists,
  // so attackers can't use this endpoint to enumerate registered emails.
  if (!user) {
    return res.json({ message: 'If that email exists, a reset link has been sent.' });
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  await prisma.passwordResetToken.create({
    data: {
      tokenHash,
      userId: user.id,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
    },
  });

  // In production this raw token is emailed to the user as a reset link,
  // e.g. `${CLIENT_URL}/reset-password?token=${rawToken}` — never logged or
  // returned by the API. It's included in the dev response here only so
  // this endpoint is testable without an email provider configured.
  res.json({
    message: 'If that email exists, a reset link has been sent.',
    ...(process.env.NODE_ENV !== 'production' && { devResetToken: rawToken }),
  });
});

// POST /api/auth/reset-password
const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) {
    return res.status(400).json({ message: 'Token and new password are required.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters.' });
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const resetRecord = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!resetRecord || resetRecord.expiresAt < new Date()) {
    return res.status(400).json({ message: 'This reset link is invalid or has expired.' });
  }

  const hashed = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { id: resetRecord.userId }, data: { password: hashed } });
  await prisma.passwordResetToken.delete({ where: { id: resetRecord.id } });

  res.json({ message: 'Password updated. You can now log in.' });
});

module.exports = { register, login, me, forgotPassword, resetPassword };
