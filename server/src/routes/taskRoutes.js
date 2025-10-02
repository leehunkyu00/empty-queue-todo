const express = require('express');
const authMiddleware = require('../middleware/auth');
const taskController = require('../controllers/taskController');

const router = express.Router();

router.use(authMiddleware);

router.get('/queues', taskController.getQueues);
router.get('/schedule', taskController.getSchedule);
router.post('/tasks', taskController.createTask);
router.patch('/tasks/:taskId', taskController.updateTask);
router.post('/tasks/:taskId/complete', taskController.completeTask);
router.post('/tasks/:taskId/reopen', taskController.reopenTask);
router.delete('/tasks/:taskId', taskController.deleteTask);
router.post('/queues/reorder', taskController.reorderTasks);
router.post('/schedule/blocks', taskController.createScheduleBlock);
router.patch('/schedule/blocks/:blockId', taskController.updateScheduleBlock);
router.delete('/schedule/blocks/:blockId', taskController.deleteScheduleBlock);
router.post('/schedule/blocks/:blockId/assign', taskController.assignTaskToBlock);
router.post('/schedule/tasks/:taskId/unassign', taskController.unassignTaskFromBlock);

module.exports = router;
