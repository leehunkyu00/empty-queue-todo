const dayjs = require('dayjs');
const Task = require('../models/Task');
const User = require('../models/User');
const { listProfiles, findProfile, getPrimaryProfile } = require('../utils/profile');

function buildLevelProgress(xp) {
  const safeXp = Math.max(0, xp || 0);
  const currentLevel = Math.floor(safeXp / 200) + 1;
  const levelFloor = (currentLevel - 1) * 200;
  const nextLevelXp = currentLevel * 200;
  const delta = safeXp - levelFloor;
  const span = nextLevelXp - levelFloor;
  const progress = span === 0 ? 0 : Math.min(1, delta / span);

  return {
    level: currentLevel,
    xp: safeXp,
    currentLevelFloor: levelFloor,
    nextLevelXp,
    progress,
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

function sanitizeActiveProfile(userDoc, profile) {
  if (!profile) return null;
  const profiles = listProfiles(userDoc);
  return profiles.find((item) => item.profileId === profile.profileId) || {
    profileId: profile.profileId,
    name: profile.name,
    role: profile.role,
    avatarColor: profile.avatarColor,
  };
}

async function getDashboard(req, res) {
  try {
    const userId = req.auth.userId;
    const requestedProfileId = req.query.profileId;

    const userDoc = await User.findById(userId).lean();
    if (!userDoc) {
      return res.status(404).json({ message: 'User not found' });
    }

    const activeProfile = getActiveProfile(userDoc, requestedProfileId);
    if (!activeProfile) {
      return res.status(400).json({ message: 'No household profiles available' });
    }

    const profileFilter = { assignedProfileId: activeProfile.profileId };

    const [groupedStats, deepUpcoming, adminUpcoming] = await Promise.all([
      Task.aggregate([
        {
          $match: {
            user: req.user._id,
            ...profileFilter,
          },
        },
        {
          $group: {
            _id: { queue: '$queue', status: '$status' },
            count: { $sum: 1 },
          },
        },
      ]),
      Task.find({ user: userId, queue: 'deep', status: 'pending', ...profileFilter })
        .sort({ dueDate: 1, order: 1 })
        .limit(3)
        .lean(),
      Task.find({ user: userId, queue: 'admin', status: 'pending', ...profileFilter })
        .sort({ dueDate: 1, order: 1 })
        .limit(3)
        .lean(),
    ]);

    const sanitizedUser = { ...userDoc };
    delete sanitizedUser.passwordHash;

    const queueStats = {
      deep: { pending: 0, completed: 0 },
      admin: { pending: 0, completed: 0 },
    };

    groupedStats.forEach((entry) => {
      const { queue, status } = entry._id;
      if (!queueStats[queue]) return;
      queueStats[queue][status] = entry.count;
    });

    return res.json({
      user: sanitizedUser,
      householdMembers: listProfiles(userDoc),
      activeProfile: sanitizeActiveProfile(userDoc, activeProfile),
      levelProgress: buildLevelProgress(sanitizedUser.xp),
      queueStats,
      streak: {
        current: sanitizedUser.streakCount || 0,
        longest: sanitizedUser.longestStreak || 0,
      },
      badges: sanitizedUser.badges || [],
      upcoming: {
        deep: deepUpcoming,
        admin: adminUpcoming,
      },
    });
  } catch (error) {
    console.error('getDashboard error:', error);
    return res.status(500).json({ message: 'Failed to load dashboard' });
  }
}

async function getHistory(req, res) {
  try {
    const userId = req.auth.userId;
    const requestedProfileId = req.query.profileId;
    const rangeDays = Math.min(120, Math.max(7, Number(req.query.days) || 21));

    const userDoc = await User.findById(userId).lean();
    if (!userDoc) {
      return res.status(404).json({ message: 'User not found' });
    }

    const activeProfile = getActiveProfile(userDoc, requestedProfileId);
    if (!activeProfile) {
      return res.status(400).json({ message: 'No household profiles available' });
    }

    const startDate = dayjs().subtract(rangeDays - 1, 'day').startOf('day').toDate();

    const completions = await Task.aggregate([
      {
        $match: {
          user: req.user._id,
          assignedProfileId: activeProfile.profileId,
          status: 'completed',
          completedAt: { $gte: startDate },
        },
      },
      {
        $project: {
          day: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$completedAt',
            },
          },
        },
      },
      {
        $group: {
          _id: '$day',
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const completionMap = new Map();
    completions.forEach((entry) => {
      completionMap.set(entry._id, entry.count);
    });

    const history = [];
    for (let offset = rangeDays - 1; offset >= 0; offset -= 1) {
      const date = dayjs().subtract(offset, 'day').startOf('day');
      const key = date.format('YYYY-MM-DD');
      history.push({
        day: key,
        label: date.format('MM/DD'),
        completedCount: completionMap.get(key) || 0,
      });
    }

    return res.json({
      history,
      days: rangeDays,
      activeProfile: sanitizeActiveProfile(userDoc, activeProfile),
    });
  } catch (error) {
    console.error('getHistory error:', error);
    return res.status(500).json({ message: 'Failed to load history' });
  }
}

module.exports = {
  getDashboard,
  getHistory,
};
