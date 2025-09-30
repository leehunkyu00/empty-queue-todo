const express = require('express');
const authMiddleware = require('../middleware/auth');
const coinController = require('../controllers/coinController');

const router = express.Router();

router.use(authMiddleware);
router.get('/', coinController.listTransactions);
router.post('/spend', coinController.createSpend);

module.exports = router;
