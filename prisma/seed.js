const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const PLANS = [
  { tier: 'STARTER', name: 'Starter', priceMonthly: 9, tapLimit: 2000, productLimit: 1 },
  { tier: 'BUSINESS', name: 'Business', priceMonthly: 29, tapLimit: 10000, productLimit: 10 },
  { tier: 'ENTERPRISE', name: 'Enterprise', priceMonthly: 149, tapLimit: -1, productLimit: -1 },
];

const TEMPLATES = [
  { name: 'Payment Page', type: 'PAYMENT', config: { fields: ['businessName', 'bankName', 'accountNumber', 'accountName', 'whatsapp'] } },
  { name: 'Restaurant Menu', type: 'MENU', config: { fields: ['businessName', 'whatsapp', 'website', 'instagram', 'facebook'] } },
  { name: 'Church Donation', type: 'DONATION', config: { fields: ['businessName', 'bankName', 'accountNumber', 'accountName'] } },
  { name: 'Google Review Card', type: 'REVIEW', config: { fields: ['businessName', 'googleReviewUrl'] } },
  { name: 'Business Card', type: 'CARD', config: { fields: ['businessName', 'whatsapp', 'website', 'instagram', 'facebook'] } },
  { name: 'Attendance', type: 'ATTENDANCE', config: { fields: ['businessName'] } },
  { name: 'Visitor Registration', type: 'VISITOR', config: { fields: ['businessName'] } },
  { name: 'Asset Tracking', type: 'ASSET', config: { fields: ['businessName'] } },
];

async function main() {
  console.log('Seeding plans...');
  const plans = {};
  for (const p of PLANS) {
    plans[p.tier] = await prisma.plan.upsert({
      where: { tier: p.tier },
      update: p,
      create: p,
    });
  }

  console.log('Seeding templates...');
  for (const t of TEMPLATES) {
    const existing = await prisma.template.findFirst({ where: { type: t.type } });
    if (!existing) await prisma.template.create({ data: t });
  }

  console.log('Seeding admin user...');
  const adminPassword = await bcrypt.hash('Admin@123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@itapnfc.tech' },
    update: {},
    create: {
      name: 'Admin',
      email: 'admin@itapnfc.tech',
      password: adminPassword,
      role: 'ADMIN',
      businessName: 'iTapNFC HQ',
    },
  });

  console.log('Seeding demo business user...');
  const demoPassword = await bcrypt.hash('Demo@123', 10);
  const demo = await prisma.user.upsert({
    where: { email: 'grace@gracebistro.com' },
    update: {},
    create: {
      name: 'Grace Adebayo',
      email: 'grace@gracebistro.com',
      password: demoPassword,
      businessName: 'Grace Bistro',
      themeColor: '#6D5CFF',
      subscription: {
        create: {
          planId: plans.BUSINESS.id,
          status: 'ACTIVE',
          renewsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      },
    },
  });

  const existingProduct = await prisma.product.findUnique({ where: { slug: 'grace-bistro-pay' } });
  let product = existingProduct;
  if (!product) {
    product = await prisma.product.create({
      data: {
        userId: demo.id,
        type: 'PAYMENT',
        name: 'Payment Page — Grace Bistro',
        slug: 'grace-bistro-pay',
        status: 'LIVE',
        themeColor: '#6D5CFF',
        fields: {
          businessName: 'Grace Bistro',
          bankName: 'Zenith Bank',
          accountNumber: '2210045871',
          accountName: 'Grace Bistro Ltd',
          whatsapp: '+2348012345678',
        },
      },
    });
  }

  console.log('Seeding sample taps...');
  const devices = ['ios', 'android', 'other'];
  const tapCount = await prisma.tap.count({ where: { productId: product.id } });
  if (tapCount === 0) {
    const taps = Array.from({ length: 40 }, (_, i) => ({
      productId: product.id,
      device: devices[i % devices.length],
      userAgent: 'seed-script',
      createdAt: new Date(Date.now() - i * 60 * 60 * 1000),
    }));
    await prisma.tap.createMany({ data: taps });
  }

  console.log('Seed complete.');
  console.log('Admin login   -> admin@itapnfc.tech / Admin@123');
  console.log('Demo business -> grace@gracebistro.com / Demo@123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
