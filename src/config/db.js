const { PrismaClient } = require('@prisma/client');

const prisma = global.__itapnfc_prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.__itapnfc_prisma = prisma;
}

module.exports = prisma;
