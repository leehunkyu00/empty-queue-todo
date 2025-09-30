const mongoose = require('mongoose');
const Task = require('../models/Task');
const User = require('../models/User');
const {
  applyTaskCompletion,
  XP_BY_DIFFICULTY,
  COINS_BY_DIFFICULTY,
  calculateLevel,
} = require('../utils/gamification');
const { listProfiles, findProfile, getPrimaryProfile } = require('../utils/profile');

const QUEUE_METADATA = {
  deep: {
    key: 'deep',
    label: 'Deep Work Queue',
    description: 'High-impact, focus-intensive tasks you schedule for your deep work block.',
  },
  admin: {
    key: 'admin',
    label: 'Admin Queue',
    description: 'Quick wins, shallow work, and operational tasks to batch together.',
  },
};

function buildQueuePayload(tasksByQueue, queueKey) {
  const meta = QUEUE_METADATA[queueKey];
  const queueTasks = tasksByQueue.filter((task) => task.queue === queueKey);
  return {
    ...meta,
    tasks: queueTasks,
    isEmpty: queueTasks.length === 0,
    focusTask: queueTasks.length > 0 ? queueTasks[0] : null,
  };
}

function getActiveProfile(userDoc, requestedProfileId) {
  if (!userDoc) return null;
  if (requestedProfileId) {
    const match = findProfile(userDoc, requestedProfileId);
    if (match) {
      return match;
    }
  }
  return getPrimaryProfile(userDoc);
}

async function getQueues(req, res) {
  try {
    const userId = req.auth.userId;
    const requestedProfileId = req.query.profileId;
    const activeProfile = getActiveProfile(req.user, requestedProfileId);

    if (!activeProfile) {
      return res.status(400).json({ message: 'No household profiles available' });
    }

    const profileFilter = { assignedProfileId: activeProfile.profileId };

    const [pendingTasks, recentCompleted] = await Promise.all([
      Task.find({ user: userId, status: 'pending', ...profileFilter })
        .sort({ queue: 1, order: 1, createdAt: 1 })
        .lean(),
      Task.find({ user: userId, status: 'completed', ...profileFilter })
        .sort({ completedAt: -1 })
        .limit(10)
        .lean(),
    ]);

    const queues = {
      deep: buildQueuePayload(pendingTasks, 'deep'),
      admin: buildQueuePayload(pendingTasks, 'admin'),
    };

    const profiles = listProfiles(req.user);
    const activeProfilePayload =
      profiles.find((profile) => profile.profileId === activeProfile.profileId) || {
        profileId: activeProfile.profileId,
        name: activeProfile.name,
        role: activeProfile.role,
        avatarColor: activeProfile.avatarColor,
      };

    return res.json({
      queues,
      recentCompleted,
      profiles,
      activeProfile: activeProfilePayload,
    });
  } catch (error) {
    console.error('getQueues error:', error);
    return res.status(500).json({ message: 'Failed to load queues' });
  }
}

async function createTask(req, res) {
  try {
    const userId = req.auth.userId;
    const {
      title,
      description = '',
      queue,
      difficulty = 'medium',
      estimatedMinutes,
      dueDate,
      priority = 0,
      assignedProfileId,
    } = req.body;

    if (!title || !queue) {
      return res.status(400).json({ message: 'Title and queue are required' });
    }

    if (!QUEUE_METADATA[queue]) {
      return res.status(400).json({ message: 'Queue must be either deep or admin' });
    }

    const requestedProfileId = assignedProfileId || req.query.profileId;
    const assigneeProfile = getActiveProfile(req.user, requestedProfileId);

    if (!assigneeProfile) {
      return res.status(400).json({ message: 'Assigned profile not found' });
    }

    const lastTask = await Task.findOne({
      user: userId,
      queue,
      status: 'pending',
      assignedProfileId: assigneeProfile.profileId,
    })
      .sort({ order: -1 })
      .select('order')
      .lean();

    const order = lastTask ? lastTask.order + 1 : 1;

    const task = await Task.create({
      user: userId,
      title,
      description,
      queue,
      difficulty,
      estimatedMinutes,
      dueDate,
      priority,
      order,
      assignedProfileId: assigneeProfile.profileId,
      assignedProfileName: assigneeProfile.name,
    });

    return res.status(201).json({ task });
  } catch (error) {
    console.error('createTask error:', error);
    return res.status(500).json({ message: 'Failed to create task' });
  }
}

async function updateTask(req, res) {
  try {
    const userId = req.auth.userId;
    const taskId = req.params.taskId;

    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({ message: 'Invalid task id' });
    }

    const task = await Task.findOne({ _id: taskId, user: userId });
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const activeProfile = getActiveProfile(req.user, req.query.profileId || task.assignedProfileId);
    if (!activeProfile || task.assignedProfileId !== activeProfile.profileId) {
      return res.status(403).json({ message: 'Task belongs to a different profile' });
    }

    const {
      title,
      description,
      difficulty,
      estimatedMinutes,
      dueDate,
      queue,
      priority,
      assignedProfileId,
    } = req.body;

    const originalQueue = task.queue;
    const originalProfileId = task.assignedProfileId;

    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (difficulty !== undefined) task.difficulty = difficulty;
    if (estimatedMinutes !== undefined) task.estimatedMinutes = estimatedMinutes;
    if (dueDate !== undefined) task.dueDate = dueDate;
    if (priority !== undefined) task.priority = priority;

    if (assignedProfileId !== undefined && assignedProfileId !== originalProfileId) {
      const newProfile = findProfile(req.user, assignedProfileId);
      if (!newProfile) {
        return res.status(400).json({ message: 'Assigned profile not found' });
      }
      task.assignedProfileId = newProfile.profileId;
      task.assignedProfileName = newProfile.name;
      const lastTaskForProfile = await Task.findOne({
        user: userId,
        queue: task.queue,
        status: 'pending',
        assignedProfileId: newProfile.profileId,
        _id: { $ne: task.id },
      })
        .sort({ order: -1 })
        .select('order')
        .lean();
      task.order = lastTaskForProfile ? lastTaskForProfile.order + 1 : 1;
    }

    if (queue && queue !== originalQueue) {
      if (!QUEUE_METADATA[queue]) {
        return res.status(400).json({ message: 'Invalid queue selection' });
      }
      task.queue = queue;
      const lastTask = await Task.findOne({
        user: userId,
        queue,
        status: 'pending',
        assignedProfileId: task.assignedProfileId,
        _id: { $ne: task.id },
      })
        .sort({ order: -1 })
        .select('order')
        .lean();
      task.order = lastTask ? lastTask.order + 1 : 1;
    }

    await task.save();
    return res.json({ task });
  } catch (error) {
    console.error('updateTask error:', error);
    return res.status(500).json({ message: 'Failed to update task' });
  }
}

async function completeTask(req, res) {
  try {
    const userId = req.auth.userId;
    const taskId = req.params.taskId;

    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({ message: 'Invalid task id' });
    }

    const task = await Task.findOne({ _id: taskId, user: userId });
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const activeProfile = getActiveProfile(req.user, req.query.profileId || task.assignedProfileId);
    if (!activeProfile || task.assignedProfileId !== activeProfile.profileId) {
      return res.status(403).json({ message: 'Task belongs to a different profile' });
    }

    if (task.status === 'completed') {
      return res.status(400).json({ message: 'Task already completed' });
    }

    task.status = 'completed';
    task.completedAt = new Date();

    const pendingCount = await Task.countDocuments({
      user: userId,
      queue: task.queue,
      status: 'pending',
      assignedProfileId: task.assignedProfileId,
      _id: { $ne: task.id },
    });
    const queueNowEmpty = pendingCount === 0;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const gamification = applyTaskCompletion({
      user,
      difficulty: task.difficulty,
      queue: task.queue,
      queueNowEmpty,
    });

    task.completionSnapshot = {
      xpAwarded: gamification.xpGain,
      coinsAwarded: gamification.coinsGain,
      queueEmptyBonusApplied: queueNowEmpty,
    };

    await Promise.all([user.save(), task.save()]);

    return res.json({ task, gamification, profile: user });
  } catch (error) {
    console.error('completeTask error:', error);
    return res.status(500).json({ message: 'Failed to complete task' });
  }
}

async function deleteTask(req, res) {
  try {
    const userId = req.auth.userId;
    const taskId = req.params.taskId;

    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({ message: 'Invalid task id' });
    }

    const task = await Task.findOne({ _id: taskId, user: userId });
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const activeProfile = getActiveProfile(req.user, req.query.profileId || task.assignedProfileId);
    if (!activeProfile || task.assignedProfileId !== activeProfile.profileId) {
      return res.status(403).json({ message: 'Task belongs to a different profile' });
    }

    await Task.deleteOne({ _id: taskId, user: userId });
    return res.json({ message: 'Task removed' });
  } catch (error) {
    console.error('deleteTask error:', error);
    return res.status(500).json({ message: 'Failed to delete task' });
  }
}

async function reopenTask(req, res) {
  try {
    const userId = req.auth.userId;
    const taskId = req.params.taskId;

    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({ message: 'Invalid task id' });
    }

    const task = await Task.findOne({ _id: taskId, user: userId });
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const activeProfile = getActiveProfile(req.user, req.query.profileId || task.assignedProfileId);
    if (!activeProfile || task.assignedProfileId !== activeProfile.profileId) {
      return res.status(403).json({ message: 'Task belongs to a different profile' });
    }

    if (task.status !== 'completed') {
      return res.status(400).json({ message: 'Task is not completed' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const snapshot = task.completionSnapshot || {};
    const baseXpValue = XP_BY_DIFFICULTY[task.difficulty] || XP_BY_DIFFICULTY.medium;
    const baseCoinValue = COINS_BY_DIFFICULTY[task.difficulty] || COINS_BY_DIFFICULTY.medium;
    const xpToRemove = snapshot.xpAwarded != null ? snapshot.xpAwarded : baseXpValue;
    const coinsToRemove = snapshot.coinsAwarded != null ? snapshot.coinsAwarded : baseCoinValue;
    const queueBonusApplied = Boolean(snapshot.queueEmptyBonusApplied);

    task.status = 'pending';
    task.completedAt = null;
    task.completionSnapshot = null;

    const lastPending = await Task.findOne({
      user: userId,
      queue: task.queue,
      status: 'pending',
      assignedProfileId: task.assignedProfileId,
      _id: { $ne: task.id },
    })
      .sort({ order: -1 })
      .select('order')
      .lean();

    task.order = lastPending ? lastPending.order + 1 : 1;

    if (user.stats) {
      user.stats.completedTasks = Math.max(0, (user.stats.completedTasks || 0) - 1);
      if (queueBonusApplied) {
        if (task.queue === 'deep') {
          user.stats.deepWorkClears = Math.max(0, (user.stats.deepWorkClears || 0) - 1);
        }
        if (task.queue === 'admin') {
          user.stats.adminClears = Math.max(0, (user.stats.adminClears || 0) - 1);
        }
      }
    }

    user.xp = Math.max(0, (user.xp || 0) - xpToRemove);
    user.coins = Math.max(0, (user.coins || 0) - coinsToRemove);
    user.level = calculateLevel(user.xp || 0);

    await Promise.all([user.save(), task.save()]);

    return res.json({
      task,
      profile: user,
      reverted: {
        xpRemoved: xpToRemove,
        coinsRemoved: coinsToRemove,
      },
    });
  } catch (error) {
    console.error('reopenTask error:', error);
    return res.status(500).json({ message: 'Failed to reopen task' });
  }
}

async function reorderTasks(req, res) {
  try {
    const userId = req.auth.userId;
    const { queue, orderedTaskIds, profileId } = req.body;

    if (!QUEUE_METADATA[queue]) {
      return res.status(400).json({ message: 'Invalid queue selection' });
    }

    if (!Array.isArray(orderedTaskIds) || orderedTaskIds.length === 0) {
      return res.status(400).json({ message: 'orderedTaskIds must be a non-empty array' });
    }

    const activeProfile = getActiveProfile(req.user, profileId);
    if (!activeProfile) {
      return res.status(400).json({ message: 'profileId is required to reorder tasks' });
    }

    const normalizedIds = [];
    for (const value of orderedTaskIds) {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return res.status(400).json({ message: 'orderedTaskIds contains an invalid id' });
      }
      normalizedIds.push(new mongoose.Types.ObjectId(value));
    }

    const existing = await Task.find({
      user: userId,
      queue,
      status: 'pending',
      assignedProfileId: activeProfile.profileId,
      _id: { $in: normalizedIds },
    })
      .select('_id')
      .lean();

    if (existing.length !== normalizedIds.length) {
      return res.status(400).json({ message: 'One or more tasks are missing or not pending for this profile' });
    }

    const bulkOps = normalizedIds.map((taskId, index) => ({
      updateOne: {
        filter: { _id: taskId, user: userId },
        update: { $set: { order: index + 1 } },
      },
    }));

    await Task.bulkWrite(bulkOps);

    const reordered = await Task.find({
      user: userId,
      queue,
      status: 'pending',
      assignedProfileId: activeProfile.profileId,
    })
      .sort({ order: 1 })
      .lean();

    return res.json({
      queue: buildQueuePayload(reordered, queue),
    });
  } catch (error) {
    console.error('reorderTasks error:', error);
    return res.status(500).json({ message: 'Failed to reorder tasks' });
  }
}

module.exports = {
  getQueues,
  createTask,
  updateTask,
  completeTask,
  deleteTask,
  reopenTask,
  reorderTasks,
};
