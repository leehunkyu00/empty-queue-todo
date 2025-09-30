const express = require('express');
const authMiddleware = require('../middleware/auth');
const progressController = require('../controllers/progressController');

const router = express.Router();

router.use(authMiddleware);
router.get('/dashboard', progressController.getDashboard);
router.get('/history', progressController.getHistory);

module.exports = router;
