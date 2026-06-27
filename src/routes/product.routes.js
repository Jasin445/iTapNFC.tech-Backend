const express = require('express');
const requireAuth = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  createProduct,
  getMyProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  uploadLogo,
} = require('../controllers/product.controller');
const { getProductAnalytics } = require('../controllers/tap.controller');

const router = express.Router();

router.use(requireAuth);

router.post('/', createProduct);
router.get('/', getMyProducts);
router.get('/:id', getProduct);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);
router.post('/:id/logo', upload.single('logo'), uploadLogo);
router.get('/:id/analytics', getProductAnalytics);

module.exports = router;
