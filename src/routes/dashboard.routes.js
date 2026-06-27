const express = require('express');
const requireAuth = require('../middleware/auth');
const { getDashboardSummary } = require('../controllers/tap.controller');

const router = express.Router();

router.use(requireAuth);
router.get('/summary', getDashboardSummary);

module.exports = router;
