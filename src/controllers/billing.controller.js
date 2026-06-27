const prisma = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/billing/plans  (public-ish, but kept under auth for simplicity)
const getPlans = asyncHandler(async (req, res) => {
  const plans = await prisma.plan.findMany({ orderBy: { priceMonthly: 'asc' } });
  res.json({ plans });
});

// GET /api/billing/subscription
const getMySubscription = asyncHandler(async (req, res) => {
  const subscription = await prisma.subscription.findUnique({
    where: { userId: req.user.id },
    include: { plan: true },
  });
  if (!subscription) return res.status(404).json({ message: 'No subscription found.' });
  res.json({ subscription });
});

// PUT /api/billing/subscription/plan  { tier: "BUSINESS" }
const changePlan = asyncHandler(async (req, res) => {
  const { tier } = req.body;
  const plan = await prisma.plan.findUnique({ where: { tier } });
  if (!plan) return res.status(400).json({ message: 'Unknown plan tier.' });

  const subscription = await prisma.subscription.update({
    where: { userId: req.user.id },
    data: { planId: plan.id, status: 'ACTIVE' },
    include: { plan: true },
  });

  res.json({ subscription });
});

// DELETE /api/billing/subscription
const cancelSubscription = asyncHandler(async (req, res) => {
  const subscription = await prisma.subscription.update({
    where: { userId: req.user.id },
    data: { status: 'CANCELED' },
  });
  res.json({ subscription, message: 'Subscription canceled.' });
});

module.exports = { getPlans, getMySubscription, changePlan, cancelSubscription };
