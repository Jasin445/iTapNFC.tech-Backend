const { verifyToken } = require('../utils/jwt');
const prisma = require('../config/db');

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided.' });
    }
    
    const decoded = verifyToken(token);
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        name: true,
        email: true,
        businessName: true,
        role: true,
        status: true,
        themeColor: true,
        logoUrl: true,
      },
    });
    
    if (!user) {
      return res.status(401).json({ message: 'User no longer exists.' });
    }
    if (user.status === 'SUSPENDED') {
      return res.status(403).json({ message: 'This account has been suspended.' });
    }

    req.user = user;
    next();
  } catch (err) {
    console.log(err)
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

module.exports = requireAuth;
