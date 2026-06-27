const prisma = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { deviceFromUserAgent } = require('../utils/device');

// POST /api/p/:slug/tap  (PUBLIC — called by the live product page the instant it loads)
const logTap = asyncHandler(async (req, res) => {
  const product = await prisma.product.findUnique({ where: { slug: req.params.slug } });
  if (!product || product.status !== 'LIVE') {
    return res.status(404).json({ message: 'This page is not available.' });
  }

  const userAgent = req.headers['user-agent'] || '';
  await prisma.tap.create({
    data: {
      productId: product.id,
      device: deviceFromUserAgent(userAgent),
      userAgent,
      ip: req.ip,
    },
  });

  res.status(201).json({ message: 'Tap recorded.' });
});

// GET /api/dashboard/summary  (AUTH — powers the widgets + charts on the dashboard)
const getDashboardSummary = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [totalProducts, totalTaps, todayTaps, deviceUsageRaw, topProducts] = await Promise.all([
    prisma.product.count({ where: { userId } }),
    prisma.tap.count({ where: { product: { userId } } }),
    prisma.tap.count({ where: { product: { userId }, createdAt: { gte: startOfToday } } }),
    prisma.tap.groupBy({
      by: ['device'],
      where: { product: { userId } },
      _count: { _all: true },
    }),
    prisma.product.findMany({
      where: { userId },
      include: { _count: { select: { taps: true } } },
      orderBy: { taps: { _count: 'desc' } },
      take: 5,
    }),
  ]);

  const dailyTaps = await prisma.$queryRaw`
    SELECT date_trunc('day', t."createdAt") AS day, COUNT(*)::int AS taps
    FROM "Tap" t
    JOIN "Product" p ON p.id = t."productId"
    WHERE p."userId" = ${userId} AND t."createdAt" >= NOW() - INTERVAL '7 days'
    GROUP BY day ORDER BY day ASC;
  `;

  const monthlyTaps = await prisma.$queryRaw`
    SELECT date_trunc('month', t."createdAt") AS month, COUNT(*)::int AS taps
    FROM "Tap" t
    JOIN "Product" p ON p.id = t."productId"
    WHERE p."userId" = ${userId} AND t."createdAt" >= NOW() - INTERVAL '6 months'
    GROUP BY month ORDER BY month ASC;
  `;

  res.json({
    totalProducts,
    totalTaps,
    todayTaps,
    deviceUsage: deviceUsageRaw.map((d) => ({ device: d.device, count: d._count._all })),
    topProducts: topProducts.map((p) => ({ id: p.id, name: p.name, taps: p._count.taps })),
    dailyTaps,
    monthlyTaps,
  });
});

// GET /api/products/:id/analytics  (AUTH — deep dive on a single product)
const getProductAnalytics = asyncHandler(async (req, res) => {
  const product = await prisma.product.findFirst({ where: { id: req.params.id, userId: req.user.id } });
  if (!product) return res.status(404).json({ message: 'Product not found.' });

  const [totalTaps, deviceUsageRaw] = await Promise.all([
    prisma.tap.count({ where: { productId: product.id } }),
    prisma.tap.groupBy({ by: ['device'], where: { productId: product.id }, _count: { _all: true } }),
  ]);

  const dailyTaps = await prisma.$queryRaw`
    SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::int AS taps
    FROM "Tap"
    WHERE "productId" = ${product.id} AND "createdAt" >= NOW() - INTERVAL '30 days'
    GROUP BY day ORDER BY day ASC;
  `;

  res.json({
    product: { id: product.id, name: product.name, type: product.type },
    totalTaps,
    deviceUsage: deviceUsageRaw.map((d) => ({ device: d.device, count: d._count._all })),
    dailyTaps,
  });
});

module.exports = { logTap, getDashboardSummary, getProductAnalytics };
