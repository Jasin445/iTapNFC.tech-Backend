const express = require('express');
const requireAuth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const admin = require('../controllers/admin.controller');

const router = express.Router();

router.use(requireAuth, requireAdmin);

// Users
router.get('/users', admin.listUsers);
router.patch('/users/:id/status', admin.setUserStatus);

// Products
router.get('/products', admin.listAllProducts);
router.patch('/products/:id/status', admin.setProductStatus);

// Templates
router.get('/templates', admin.listTemplates);
router.post('/templates', admin.createTemplate);
router.put('/templates/:id', admin.updateTemplate);
router.delete('/templates/:id', admin.deleteTemplate);

// Subscriptions
router.get('/subscriptions', admin.listSubscriptions);
router.patch('/subscriptions/:id', admin.updateSubscriptionStatus);

// Analytics
router.get('/analytics', admin.getPlatformAnalytics);

// Export reports (CSV)
router.get('/export/:type', admin.exportReport);

module.exports = router;
