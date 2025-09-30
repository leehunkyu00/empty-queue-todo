const express = require('express');
const authMiddleware = require('../middleware/auth');
const taskController = require('../controllers/taskController');

const router = express.Router();

router.use(authMiddleware);

router.get('/queues', taskController.getQueues);
router.post('/tasks', taskController.createTask);
router.patch('/tasks/:taskId', taskController.updateTask);
router.post('/tasks/:taskId/complete', taskController.completeTask);
router.post('/tasks/:taskId/reopen', taskController.reopenTask);
router.delete('/tasks/:taskId', taskController.deleteTask);
router.post('/queues/reorder', taskController.reorderTasks);

module.exports = router;
