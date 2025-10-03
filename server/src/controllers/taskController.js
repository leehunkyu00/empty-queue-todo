const mongoose = require('mongoose');
const dayjs = require('dayjs');
const Task = require('../models/Task');
const User = require('../models/User');
const ScheduleBlock = require('../models/ScheduleBlock');
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

function sanitizeProfile(userDoc, profile) {
  if (!profile) return null;
  const profiles = listProfiles(userDoc);
  return profiles.find((item) => item.profileId === profile.profileId) || {
    profileId: profile.profileId,
    name: profile.name,
    role: profile.role,
    avatarColor: profile.avatarColor,
  };
}

const MINUTES_IN_DAY = 24 * 60;
const MIN_BLOCK_DURATION_MINUTES = 15;

const VALID_WEEKDAY_VALUES = new Set([0, 1, 2, 3, 4, 5, 6]);

function normalizeDaysOfWeek(values) {
  if (!Array.isArray(values)) {
    return undefined;
  }
  const normalized = Array.from(
    new Set(
      values
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && VALID_WEEKDAY_VALUES.has(value))
    )
  ).sort((a, b) => a - b);
  return normalized.length > 0 ? normalized : undefined;
}

function blockOverlapsDay(block, dayStart, dayEnd) {
  const blockStart = dayjs(block?.start);
  const blockEnd = dayjs(block?.end);
  if (!blockStart.isValid() || !blockEnd.isValid()) {
    return false;
  }
  return blockStart.isBefore(dayEnd) && blockEnd.isAfter(dayStart);
}

function blockAppliesOnDay(block, targetDay, dayStart, dayEnd) {
  const recurring = block?.isRecurring !== false;
  if (!recurring) {
    return blockOverlapsDay(block, dayStart, dayEnd);
  }
  if (Array.isArray(block?.daysOfWeek) && block.daysOfWeek.length > 0) {
    return block.daysOfWeek.includes(targetDay.day());
  }
  return true;
}

function normalizeMinuteInput(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  return Math.round(numeric);
}

function clampMinuteRange(startMinute, endMinute) {
  let start = Math.max(0, Math.min(startMinute, MINUTES_IN_DAY - MIN_BLOCK_DURATION_MINUTES));
  let end = Math.max(start + MIN_BLOCK_DURATION_MINUTES, Math.min(endMinute, MINUTES_IN_DAY));
  end = Math.min(end, MINUTES_IN_DAY);
  return { start, end };
}

function deriveMinuteOfDay(value) {
  const parsed = dayjs(value);
  if (!parsed.isValid()) {
    return null;
  }
  return parsed.diff(parsed.startOf('day'), 'minute');
}

function resolveBlockMinutes(block) {
  let startMinute = Number.isFinite(block?.startMinuteOfDay)
    ? block.startMinuteOfDay
    : deriveMinuteOfDay(block?.start);
  let endMinute = Number.isFinite(block?.endMinuteOfDay)
    ? block.endMinuteOfDay
    : deriveMinuteOfDay(block?.end);

  if (!Number.isFinite(startMinute)) {
    startMinute = 9 * 60; // default to 09:00 if data is missing
  }
  startMinute = Math.max(0, Math.min(startMinute, MINUTES_IN_DAY - MIN_BLOCK_DURATION_MINUTES));

  if (!Number.isFinite(endMinute)) {
    endMinute = startMinute + 60;
  }
  endMinute = Math.max(startMinute + MIN_BLOCK_DURATION_MINUTES, Math.min(endMinute, MINUTES_IN_DAY));

  return { startMinute, endMinute };
}

function buildBlockInstanceForDay(block, targetDay) {
  const { startMinute, endMinute } = resolveBlockMinutes(block);
  const isRecurring = block?.isRecurring !== false;
  if (!isRecurring) {
    const startDate = dayjs(block?.start);
    const endDate = dayjs(block?.end);
    const dayStartFallback = targetDay.startOf('day');
    return {
      start: startDate.isValid() ? startDate.toDate() : dayStartFallback.add(startMinute, 'minute').toDate(),
      end: endDate.isValid() ? endDate.toDate() : dayStartFallback.add(endMinute, 'minute').toDate(),
      startMinute,
      endMinute,
    };
  }
  const dayStart = targetDay.startOf('day');
  return {
    start: dayStart.add(startMinute, 'minute').toDate(),
    end: dayStart.add(endMinute, 'minute').toDate(),
    startMinute,
    endMinute,
  };
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
      priority = 0,
      assignedProfileId,
      scheduledStart,
      scheduledEnd,
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

    if (scheduledStart && scheduledEnd) {
      const startDate = new Date(scheduledStart);
      const endDate = new Date(scheduledEnd);
      if (!(startDate instanceof Date && !Number.isNaN(startDate.valueOf())) || !(endDate instanceof Date && !Number.isNaN(endDate.valueOf())) || endDate <= startDate) {
        return res.status(400).json({ message: 'scheduledEnd must be after scheduledStart' });
      }
    }

    const scheduledDateKey = scheduledStart ? dayjs(scheduledStart).format('YYYY-MM-DD') : null;

    const task = await Task.create({
      user: userId,
      title,
      description,
      queue,
      difficulty,
      priority,
      order,
      assignedProfileId: assigneeProfile.profileId,
      assignedProfileName: assigneeProfile.name,
      scheduledStart: scheduledStart ? new Date(scheduledStart) : undefined,
      scheduledEnd: scheduledEnd ? new Date(scheduledEnd) : undefined,
      scheduledDateKey,
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
      queue,
      priority,
      assignedProfileId,
      scheduledStart,
      scheduledEnd,
    } = req.body;

    const originalQueue = task.queue;
    const originalProfileId = task.assignedProfileId;

    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (difficulty !== undefined) task.difficulty = difficulty;
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

    if (scheduledStart !== undefined || scheduledEnd !== undefined) {
      if (scheduledStart && scheduledEnd) {
        const startDate = new Date(scheduledStart);
        const endDate = new Date(scheduledEnd);
        if (!(startDate instanceof Date && !Number.isNaN(startDate.valueOf())) || !(endDate instanceof Date && !Number.isNaN(endDate.valueOf())) || endDate <= startDate) {
          return res.status(400).json({ message: 'scheduledEnd must be after scheduledStart' });
        }
        task.scheduledStart = startDate;
        task.scheduledEnd = endDate;
        task.scheduledDateKey = dayjs(startDate).format('YYYY-MM-DD');
      } else if (!scheduledStart && !scheduledEnd) {
        task.scheduledStart = null;
        task.scheduledEnd = null;
        task.scheduledDateKey = null;
      } else {
        return res.status(400).json({ message: 'Both scheduledStart and scheduledEnd are required to set a schedule' });
      }
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

async function getSchedule(req, res) {
  try {
    const userId = req.auth.userId;
    const requestedProfileId = req.query.profileId;
    const dateParam = req.query.date;

    if (!dateParam) {
      return res.status(400).json({ message: 'date query parameter is required' });
    }

    const targetDay = dayjs(dateParam);
    if (!targetDay.isValid()) {
      return res.status(400).json({ message: 'Invalid date format' });
    }

    const userDoc = await User.findById(userId).lean();
    if (!userDoc) {
      return res.status(404).json({ message: 'User not found' });
    }

    const activeProfile = getActiveProfile(userDoc, requestedProfileId);
    if (!activeProfile) {
      return res.status(400).json({ message: 'No household profiles available' });
    }

    const dayStart = targetDay.startOf('day');
    const dayEnd = targetDay.endOf('day');
    const dayStartDate = dayStart.toDate();
    const dayEndDate = dayEnd.toDate();

    const rawBlocks = await ScheduleBlock.find({
      user: userId,
      profileId: activeProfile.profileId,
    })
      .sort({ startMinuteOfDay: 1, start: 1 })
      .lean();

    const blocks = rawBlocks.filter((block) => blockAppliesOnDay(block, targetDay, dayStart, dayEnd));

    const targetDateKey = targetDay.format('YYYY-MM-DD');

    const scheduledTasks = await Task.find({
      user: userId,
      assignedProfileId: activeProfile.profileId,
      scheduledBlock: { $ne: null },
      $or: [
        { scheduledDateKey: targetDateKey },
        {
          $and: [
            { $or: [{ scheduledDateKey: { $exists: false } }, { scheduledDateKey: null }] },
            { scheduledStart: { $gte: dayStartDate, $lt: dayEndDate } },
          ],
        },
        {
          $and: [
            { $or: [{ scheduledDateKey: { $exists: false } }, { scheduledDateKey: null }] },
            { scheduledStart: { $exists: false } },
          ],
        },
        {
          $and: [
            { $or: [{ scheduledDateKey: { $exists: false } }, { scheduledDateKey: null }] },
            { scheduledStart: null },
          ],
        },
      ],
    })
      .lean();

    const unscheduled = await Task.find({
      user: userId,
      assignedProfileId: activeProfile.profileId,
      status: 'pending',
      $or: [
        { queue: 'deep' },
        {
          queue: 'admin',
          $or: [
            { scheduledBlock: { $exists: false } },
            { scheduledBlock: null },
          ],
        },
      ],
    })
      .sort({ queue: 1, order: 1 })
      .lean();

    const blocksWithTasks = blocks.map((block) => {
      const instance = buildBlockInstanceForDay(block, targetDay);
      const tasksForBlock = scheduledTasks
        .filter((task) => {
          if (!task.scheduledBlock || task.scheduledBlock.toString() !== block._id.toString()) {
            return false;
          }
          if (task.scheduledDateKey) {
            return task.scheduledDateKey === targetDateKey;
          }
          if (!task.scheduledStart) {
            return true;
          }
          const scheduledDate = dayjs(task.scheduledStart);
          return scheduledDate.isSame(targetDay, 'day');
        })
        .sort((a, b) => {
          const aStart = a.scheduledStart ? new Date(a.scheduledStart).valueOf() : 0;
          const bStart = b.scheduledStart ? new Date(b.scheduledStart).valueOf() : 0;
          return aStart - bStart;
        });

      const daysOfWeek = block.isRecurring !== false ? normalizeDaysOfWeek(block.daysOfWeek) : undefined;
      return {
        ...block,
        isRecurring: block.isRecurring !== false,
        daysOfWeek,
        ...instance,
        tasks: tasksForBlock,
      };
    });

    return res.json({
      blocks: blocksWithTasks,
      unscheduled,
      activeProfile: sanitizeProfile(userDoc, activeProfile),
      profiles: listProfiles(userDoc),
      date: targetDay.format('YYYY-MM-DD'),
    });
  } catch (error) {
    console.error('getSchedule error:', error);
    return res.status(500).json({ message: 'Failed to load schedule' });
  }
}

async function createScheduleBlock(req, res) {
  try {
    const userId = req.auth.userId;
    const { profileId, start, end, type, title, notes, recurring, isRecurring, daysOfWeek, startMinuteOfDay, endMinuteOfDay } = req.body;

    if (!start || !end || !type) {
      return res.status(400).json({ message: 'start, end, and type are required' });
    }

    if (!['deep', 'admin'].includes(type)) {
      return res.status(400).json({ message: 'type must be deep or admin' });
    }

    const startDate = new Date(start);
    const endDate = new Date(end);
    if (Number.isNaN(startDate.valueOf()) || Number.isNaN(endDate.valueOf())) {
      return res.status(400).json({ message: 'Invalid start/end range' });
    }

    if (!(endDate > startDate)) {
      return res.status(400).json({ message: 'Invalid start/end range' });
    }

    let startMinute = normalizeMinuteInput(startMinuteOfDay);
    let endMinute = normalizeMinuteInput(endMinuteOfDay);

    if (!Number.isFinite(startMinute)) {
      startMinute = startDate.getHours() * 60 + startDate.getMinutes();
    }
    if (!Number.isFinite(endMinute)) {
      endMinute = endDate.getHours() * 60 + endDate.getMinutes();
    }

    if (!Number.isFinite(startMinute) || !Number.isFinite(endMinute)) {
      return res.status(400).json({ message: 'Invalid start/end range' });
    }

    ({ start: startMinute, end: endMinute } = clampMinuteRange(startMinute, endMinute));

    const recurringFlag = recurring ?? isRecurring;
    const isRecurringBlock = recurringFlag !== false;
    const normalizedDays = isRecurringBlock ? normalizeDaysOfWeek(daysOfWeek) : undefined;

    const userDoc = await User.findById(userId);
    if (!userDoc) {
      return res.status(404).json({ message: 'User not found' });
    }

    const activeProfile = getActiveProfile(userDoc, profileId);
    if (!activeProfile) {
      return res.status(400).json({ message: 'No household profiles available' });
    }

    const block = await ScheduleBlock.create({
      user: userId,
      profileId: activeProfile.profileId,
      profileName: activeProfile.name,
      type,
      title: title?.trim(),
      notes: notes?.trim(),
      start: startDate,
      end: endDate,
      startMinuteOfDay: startMinute,
      endMinuteOfDay: endMinute,
      isRecurring: isRecurringBlock,
      daysOfWeek: normalizedDays,
    });

    return res.status(201).json({ block });
  } catch (error) {
    console.error('createScheduleBlock error:', error);
    return res.status(500).json({ message: 'Failed to create schedule block' });
  }
}

async function updateScheduleBlock(req, res) {
  try {
    const userId = req.auth.userId;
    const { blockId } = req.params;
    const { start, end, type, title, notes, recurring, isRecurring, daysOfWeek, startMinuteOfDay, endMinuteOfDay } = req.body;

    const block = await ScheduleBlock.findOne({ _id: blockId, user: userId });
    if (!block) {
      return res.status(404).json({ message: 'Schedule block not found' });
    }

    let workingStartDate = block.start;
    let workingEndDate = block.end;

    if (start || end) {
      const startDate = start ? new Date(start) : block.start;
      const endDate = end ? new Date(end) : block.end;
      if (Number.isNaN(startDate.valueOf()) || Number.isNaN(endDate.valueOf())) {
        return res.status(400).json({ message: 'Invalid start/end range' });
      }

      if (!(endDate > startDate)) {
        return res.status(400).json({ message: 'Invalid start/end range' });
      }

      workingStartDate = startDate;
      workingEndDate = endDate;
      block.start = startDate;
      block.end = endDate;
    }

    let startMinute = normalizeMinuteInput(startMinuteOfDay);
    let endMinute = normalizeMinuteInput(endMinuteOfDay);

    if (!Number.isFinite(startMinute)) {
      if (start || !Number.isFinite(block.startMinuteOfDay)) {
        startMinute = deriveMinuteOfDay(workingStartDate);
      } else {
        startMinute = block.startMinuteOfDay;
      }
    }

    if (!Number.isFinite(endMinute)) {
      if (end || !Number.isFinite(block.endMinuteOfDay)) {
        endMinute = deriveMinuteOfDay(workingEndDate);
      } else {
        endMinute = block.endMinuteOfDay;
      }
    }

    if (!Number.isFinite(startMinute) || !Number.isFinite(endMinute)) {
      return res.status(400).json({ message: 'Invalid start/end range' });
    }

    ({ start: startMinute, end: endMinute } = clampMinuteRange(startMinute, endMinute));

    block.startMinuteOfDay = startMinute;
    block.endMinuteOfDay = endMinute;

    if (type) {
      if (!['deep', 'admin'].includes(type)) {
        return res.status(400).json({ message: 'type must be deep or admin' });
      }
      block.type = type;
    }

    if (recurring !== undefined || isRecurring !== undefined) {
      const nextRecurring = (recurring ?? isRecurring) !== false;
      block.isRecurring = nextRecurring;
      if (!nextRecurring) {
        block.daysOfWeek = undefined;
      }
    }

    if (daysOfWeek !== undefined) {
      if (block.isRecurring !== false) {
        block.daysOfWeek = normalizeDaysOfWeek(daysOfWeek);
      } else {
        block.daysOfWeek = undefined;
      }
    }

    if (title !== undefined) block.title = title?.trim();
    if (notes !== undefined) block.notes = notes?.trim();

    if (!Number.isFinite(block.startMinuteOfDay) || !Number.isFinite(block.endMinuteOfDay)) {
      const { startMinute, endMinute } = resolveBlockMinutes(block);
      block.startMinuteOfDay = startMinute;
      block.endMinuteOfDay = endMinute;
    }

    await block.save();
    return res.json({ block });
  } catch (error) {
    console.error('updateScheduleBlock error:', error);
    return res.status(500).json({ message: 'Failed to update schedule block' });
  }
}

async function deleteScheduleBlock(req, res) {
  try {
    const userId = req.auth.userId;
    const { blockId } = req.params;

    const block = await ScheduleBlock.findOne({ _id: blockId, user: userId });
    if (!block) {
      return res.status(404).json({ message: 'Schedule block not found' });
    }

    await Task.updateMany(
      { scheduledBlock: block._id },
      { $set: { scheduledBlock: null, scheduledStart: null, scheduledEnd: null, scheduledDateKey: null } }
    );
    await block.deleteOne();

    return res.json({ message: 'Schedule block removed' });
  } catch (error) {
    console.error('deleteScheduleBlock error:', error);
    return res.status(500).json({ message: 'Failed to delete schedule block' });
  }
}

async function assignTaskToBlock(req, res) {
  try {
    const userId = req.auth.userId;
    const { blockId } = req.params;
    const { taskId, start, end, scheduleDate } = req.body;

    const block = await ScheduleBlock.findOne({ _id: blockId, user: userId });
    if (!block) {
      return res.status(404).json({ message: 'Schedule block not found' });
    }

    const task = await Task.findOne({ _id: taskId, user: userId });
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    if (task.assignedProfileId !== block.profileId) {
      return res.status(400).json({ message: 'Task belongs to a different profile' });
    }

    let startDate;
    let endDate;

    if (start && end) {
      const providedStart = dayjs(start);
      const providedEnd = dayjs(end);
      if (providedStart.isValid() && providedEnd.isValid() && providedEnd.isAfter(providedStart)) {
        startDate = providedStart.toDate();
        endDate = providedEnd.toDate();
      }
    }

    if (!startDate || !endDate) {
      const referenceDay = task.scheduledStart
        ? dayjs(task.scheduledStart)
        : dayjs(start || block.start || new Date());
      const { startMinute, endMinute } = resolveBlockMinutes(block);
      const dayStart = referenceDay.startOf('day');
    startDate = dayStart.add(startMinute, 'minute').toDate();
    endDate = dayStart.add(endMinute, 'minute').toDate();
    }

  // Determine schedule date key (used below for deep block uniqueness and when saving)
  let scheduleDateKey = null;
  if (typeof scheduleDate === 'string') {
    const trimmed = scheduleDate.trim();
    if (trimmed) {
      const parsed = dayjs(trimmed);
      scheduleDateKey = parsed.isValid() ? parsed.format('YYYY-MM-DD') : trimmed;
    }
  }
  if (!scheduleDateKey) {
    scheduleDateKey = dayjs(startDate).format('YYYY-MM-DD');
  }

    if (block.type === 'deep') {
      const startMoment = dayjs(startDate);
      const dayStartBoundary = startMoment.startOf('day').toDate();
      const dayEndBoundary = startMoment.endOf('day').toDate();

      const existing = await Task.countDocuments({
        scheduledBlock: block._id,
        status: 'pending',
        _id: { $ne: task._id },
        $or: [
          { scheduledDateKey: scheduleDateKey },
          {
            $and: [
              { $or: [{ scheduledDateKey: { $exists: false } }, { scheduledDateKey: null }] },
              { scheduledStart: { $exists: false } },
            ],
          },
          {
            $and: [
              { $or: [{ scheduledDateKey: { $exists: false } }, { scheduledDateKey: null }] },
              { scheduledStart: null },
            ],
          },
          {
            $and: [
              { $or: [{ scheduledDateKey: { $exists: false } }, { scheduledDateKey: null }] },
              { scheduledStart: { $gte: dayStartBoundary, $lt: dayEndBoundary } },
            ],
          },
        ],
      });
      if (existing >= 1) {
        return res.status(400).json({ message: 'Deep work 블록에는 하나의 작업만 배치할 수 있습니다.' });
      }
    }

    task.scheduledBlock = block._id;
    task.scheduledStart = startDate;
    task.scheduledEnd = endDate;
    task.scheduledDateKey = scheduleDateKey;
    await task.save();

    return res.json({ task });
  } catch (error) {
    console.error('assignTaskToBlock error:', error);
    return res.status(500).json({ message: 'Failed to assign task to block' });
  }
}

async function unassignTaskFromBlock(req, res) {
  try {
    const userId = req.auth.userId;
    const { taskId } = req.params;

    const task = await Task.findOne({ _id: taskId, user: userId });
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    task.scheduledBlock = null;
    task.scheduledStart = null;
    task.scheduledEnd = null;
    task.scheduledDateKey = null;
    await task.save();

    return res.json({ task });
  } catch (error) {
    console.error('unassignTaskFromBlock error:', error);
    return res.status(500).json({ message: 'Failed to unassign task from block' });
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
  getSchedule,
  createScheduleBlock,
  updateScheduleBlock,
  deleteScheduleBlock,
  assignTaskToBlock,
  unassignTaskFromBlock,
  reorderTasks,
};
