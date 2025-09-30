const express = require('express');
const authMiddleware = require('../middleware/auth');
const householdController = require('../controllers/householdController');

const router = express.Router();

router.use(authMiddleware);
router.get('/', householdController.listMembers);
router.post('/', householdController.createMember);
router.patch('/:profileId', householdController.updateMember);
router.delete('/:profileId', householdController.deleteMember);

module.exports = router;
