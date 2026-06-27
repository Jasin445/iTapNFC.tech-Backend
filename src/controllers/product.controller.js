const prisma = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { generateProductSlug } = require('../utils/slugify');
const cloudinary = require('../config/cloudinary');

const PRODUCT_TYPES = ['PAYMENT', 'MENU', 'DONATION', 'REVIEW', 'CARD', 'ATTENDANCE', 'VISITOR', 'ASSET'];

// POST /api/products
const createProduct = asyncHandler(async (req, res) => {
  const { type, name, fields, themeColor, status } = req.body;

  if (!type || !PRODUCT_TYPES.includes(type)) {
    return res.status(400).json({ message: `type must be one of: ${PRODUCT_TYPES.join(', ')}` });
  }
  if (!name) {
    return res.status(400).json({ message: 'name is required.' });
  }

  // Enforce the plan's product limit
  const subscription = await prisma.subscription.findUnique({
    where: { userId: req.user.id },
    include: { plan: true },
  });
  if (subscription && subscription.plan.productLimit !== -1) {
    const count = await prisma.product.count({ where: { userId: req.user.id } });
    if (count >= subscription.plan.productLimit) {
      return res.status(403).json({
        message: `Your ${subscription.plan.name} plan allows up to ${subscription.plan.productLimit} products. Upgrade to add more.`,
      });
    }
  }

  const product = await prisma.product.create({
    data: {
      userId: req.user.id,
      type,
      name,
      slug: generateProductSlug(name),
      status: status === 'LIVE' ? 'LIVE' : 'DRAFT',
      fields: fields || {},
      themeColor: themeColor || req.user.themeColor || '#6D5CFF',
    },
  });

  res.status(201).json({ product });
});

// GET /api/products
const getMyProducts = asyncHandler(async (req, res) => {
  const products = await prisma.product.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { taps: true } } },
  });
  res.json({ products });
});

// GET /api/products/:id
const getProduct = asyncHandler(async (req, res) => {
  const product = await prisma.product.findFirst({
    where: { id: req.params.id, userId: req.user.id },
  });
  if (!product) return res.status(404).json({ message: 'Product not found.' });
  res.json({ product });
});

// PUT /api/products/:id
const updateProduct = asyncHandler(async (req, res) => {
  const existing = await prisma.product.findFirst({ where: { id: req.params.id, userId: req.user.id } });
  if (!existing) return res.status(404).json({ message: 'Product not found.' });

  const { name, fields, themeColor, status } = req.body;
  const product = await prisma.product.update({
    where: { id: existing.id },
    data: {
      ...(name && { name }),
      ...(fields && { fields }),
      ...(themeColor && { themeColor }),
      ...(status && { status }),
    },
  });

  res.json({ product });
});

// DELETE /api/products/:id
const deleteProduct = asyncHandler(async (req, res) => {
  const existing = await prisma.product.findFirst({ where: { id: req.params.id, userId: req.user.id } });
  if (!existing) return res.status(404).json({ message: 'Product not found.' });

  await prisma.product.delete({ where: { id: existing.id } });
  res.json({ message: 'Product deleted.' });
});

// POST /api/products/:id/logo  (multipart/form-data, field name "logo")
const uploadLogo = asyncHandler(async (req, res) => {
  const existing = await prisma.product.findFirst({ where: { id: req.params.id, userId: req.user.id } });
  if (!existing) return res.status(404).json({ message: 'Product not found.' });
  if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });

  const uploadResult = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'itapnfc/logos', resource_type: 'image' },
      (error, result) => (error ? reject(error) : resolve(result))
    );
    stream.end(req.file.buffer);
  });

  const product = await prisma.product.update({
    where: { id: existing.id },
    data: { logoUrl: uploadResult.secure_url },
  });

  res.json({ product });
});

// GET /api/p/:slug  (PUBLIC — powers the actual page a customer sees on tap)
const getProductBySlug = asyncHandler(async (req, res) => {
  const product = await prisma.product.findUnique({
    where: { slug: req.params.slug },
    select: {
      id: true,
      type: true,
      name: true,
      slug: true,
      status: true,
      fields: true,
      themeColor: true,
      logoUrl: true,
      user: { select: { businessName: true } },
    },
  });

  if (!product || product.status !== 'LIVE') {
    return res.status(404).json({ message: 'This page is not available.' });
  }

  res.json({ product });
});

module.exports = {
  createProduct,
  getMyProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  uploadLogo,
  getProductBySlug,
};
