const prisma = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { toCSV } = require('../utils/csv');

// ---------- Users ----------

// GET /api/admin/users
const listUsers = asyncHandler(async (req, res) => {
  const { search = '', plan } = req.query;
  const users = await prisma.user.findMany({
    where: {
      role: 'USER',
      OR: search
        ? [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { businessName: { contains: search, mode: 'insensitive' } },
          ]
        : undefined,
      subscription: plan ? { plan: { tier: plan } } : undefined,
    },
    include: { subscription: { include: { plan: true } }, _count: { select: { products: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ users });
});

// PATCH /api/admin/users/:id/status   { status: "SUSPENDED" | "ACTIVE" }
const setUserStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['ACTIVE', 'SUSPENDED'].includes(status)) {
    return res.status(400).json({ message: 'status must be ACTIVE or SUSPENDED.' });
  }
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { status } });
  res.json({ user });
});

// ---------- Products ----------

// GET /api/admin/products
const listAllProducts = asyncHandler(async (req, res) => {
  const { search = '' } = req.query;
  const products = await prisma.product.findMany({
    where: search
      ? { name: { contains: search, mode: 'insensitive' } }
      : undefined,
    include: { user: { select: { name: true, businessName: true } }, _count: { select: { taps: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ products });
});

// PATCH /api/admin/products/:id/status   { status: "DISABLED" | "LIVE" | "DRAFT" }
const setProductStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['DRAFT', 'LIVE', 'DISABLED'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status.' });
  }
  const product = await prisma.product.update({ where: { id: req.params.id }, data: { status } });
  res.json({ product });
});

// ---------- Templates ----------

// GET /api/admin/templates
const listTemplates = asyncHandler(async (req, res) => {
  const templates = await prisma.template.findMany({ orderBy: { usageCount: 'desc' } });
  res.json({ templates });
});

// POST /api/admin/templates
const createTemplate = asyncHandler(async (req, res) => {
  const { name, type, config } = req.body;
  if (!name || !type) return res.status(400).json({ message: 'name and type are required.' });
  const template = await prisma.template.create({ data: { name, type, config: config || {} } });
  res.status(201).json({ template });
});

// PUT /api/admin/templates/:id
const updateTemplate = asyncHandler(async (req, res) => {
  const { name, config } = req.body;
  const template = await prisma.template.update({
    where: { id: req.params.id },
    data: { ...(name && { name }), ...(config && { config }) },
  });
  res.json({ template });
});

// DELETE /api/admin/templates/:id
const deleteTemplate = asyncHandler(async (req, res) => {
  await prisma.template.delete({ where: { id: req.params.id } });
  res.json({ message: 'Template deleted.' });
});

// ---------- Subscriptions ----------

// GET /api/admin/subscriptions
const listSubscriptions = asyncHandler(async (req, res) => {
  const subscriptions = await prisma.subscription.findMany({
    include: { plan: true, user: { select: { name: true, businessName: true, email: true } } },
    orderBy: { renewsAt: 'asc' },
  });
  res.json({ subscriptions });
});

// PATCH /api/admin/subscriptions/:id   { status }
const updateSubscriptionStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const subscription = await prisma.subscription.update({
    where: { id: req.params.id },
    data: { status },
  });
  res.json({ subscription });
});

// ---------- Analytics ----------

// GET /api/admin/analytics
const getPlatformAnalytics = asyncHandler(async (req, res) => {
  const [totalUsers, totalProducts, totalTaps, subscriptions] = await Promise.all([
    prisma.user.count({ where: { role: 'USER' } }),
    prisma.product.count(),
    prisma.tap.count(),
    prisma.subscription.findMany({ include: { plan: true } }),
  ]);

  const mrr = subscriptions
    .filter((s) => s.status === 'ACTIVE')
    .reduce((sum, s) => sum + s.plan.priceMonthly, 0);

  const planDistribution = subscriptions.reduce((acc, s) => {
    acc[s.plan.tier] = (acc[s.plan.tier] || 0) + 1;
    return acc;
  }, {});

  const monthlyTaps = await prisma.$queryRaw`
    SELECT date_trunc('month', "createdAt") AS month, COUNT(*)::int AS taps
    FROM "Tap"
    WHERE "createdAt" >= NOW() - INTERVAL '6 months'
    GROUP BY month ORDER BY month ASC;
  `;

  res.json({ totalUsers, totalProducts, totalTaps, mrr, planDistribution, monthlyTaps });
});

// ---------- Export Reports ----------

// GET /api/admin/export/:type   type = users | products | subscriptions
const exportReport = asyncHandler(async (req, res) => {
  const { type } = req.params;
  let rows = [];
  const filename = `itapnfc-${type}-report.csv`;

  if (type === 'users') {
    const users = await prisma.user.findMany({
      where: { role: 'USER' },
      include: { subscription: { include: { plan: true } } },
    });
    rows = users.map((u) => ({
      name: u.name,
      email: u.email,
      business: u.businessName || '',
      plan: u.subscription?.plan?.name || '',
      status: u.status,
      joined: u.createdAt.toISOString().slice(0, 10),
    }));
  } else if (type === 'products') {
    const products = await prisma.product.findMany({
      include: { user: { select: { businessName: true } }, _count: { select: { taps: true } } },
    });
    rows = products.map((p) => ({
      name: p.name,
      type: p.type,
      owner: p.user.businessName || '',
      taps: p._count.taps,
      status: p.status,
      created: p.createdAt.toISOString().slice(0, 10),
    }));
  } else if (type === 'subscriptions') {
    const subs = await prisma.subscription.findMany({ include: { plan: true, user: true } });
    rows = subs.map((s) => ({
      business: s.user.businessName || s.user.name,
      plan: s.plan.name,
      mrr: s.plan.priceMonthly,
      status: s.status,
      renewal: s.renewsAt.toISOString().slice(0, 10),
    }));
  } else {
    return res.status(400).json({ message: 'type must be users, products, or subscriptions.' });
  }

  const csv = toCSV(rows);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
});

module.exports = {
  listUsers,
  setUserStatus,
  listAllProducts,
  setProductStatus,
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  listSubscriptions,
  updateSubscriptionStatus,
  getPlatformAnalytics,
  exportReport,
};
