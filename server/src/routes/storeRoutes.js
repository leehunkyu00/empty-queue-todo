const express = require('express');
const authMiddleware = require('../middleware/auth');
const storeController = require('../controllers/storeController');

const router = express.Router();

router.use(authMiddleware);

router.get('/', storeController.listStore);
router.post('/', storeController.createStoreItem);
router.patch('/:itemId', storeController.updateStoreItem);
router.post('/:itemId/archive', storeController.archiveStoreItem);
router.delete('/:itemId', storeController.deleteStoreItem);
router.post('/:itemId/purchase', storeController.purchaseItem);

module.exports = router;
