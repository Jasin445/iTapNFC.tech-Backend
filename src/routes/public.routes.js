const express = require('express');
const { getProductBySlug } = require('../controllers/product.controller');
const { logTap } = require('../controllers/tap.controller');

const router = express.Router();

// GET /api/p/:slug        -> page data for the public NFC landing page
// POST /api/p/:slug/tap   -> fired by that page on load to record the tap
router.get('/:slug', getProductBySlug);
router.post('/:slug/tap', logTap);

module.exports = router;
