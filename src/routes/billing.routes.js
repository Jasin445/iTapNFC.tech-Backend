const express = require('express');
const requireAuth = require('../middleware/auth');
const {
  getPlans,
  getMySubscription,
  changePlan,
  cancelSubscription,
} = require('../controllers/billing.controller');

const router = express.Router();

router.use(requireAuth);
router.get('/plans', getPlans);
router.get('/subscription', getMySubscription);
router.put('/subscription/plan', changePlan);
router.delete('/subscription', cancelSubscription);

module.exports = router;
