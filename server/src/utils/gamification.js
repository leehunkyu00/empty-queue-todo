const dayjs = require('dayjs');

const XP_BY_DIFFICULTY = {
  easy: 40,
  medium: 65,
  hard: 95,
};

const COINS_BY_DIFFICULTY = {
  easy: 5,
  medium: 9,
  hard: 14,
};

const QUEUE_EMPTY_BONUS = {
  xp: 50,
  coins: 15,
};

function calculateLevel(xp) {
  return Math.floor(xp / 200) + 1;
}

function ensureBadge(user, badge, unlockedBadges) {
  if (!user.badges) {
    user.badges = [];
  }
  if (!user.badges.includes(badge)) {
    user.badges.push(badge);
    unlockedBadges.push(badge);
  }
}

function updateStreak(user) {
  const today = dayjs().startOf('day');
  const lastActivity = user.lastActivityDate ? dayjs(user.lastActivityDate).startOf('day') : null;

  if (!lastActivity) {
    user.streakCount = 1;
  } else {
    const diffDays = today.diff(lastActivity, 'day');
    if (diffDays === 0) {
      user.streakCount = user.streakCount || 1;
    } else if (diffDays === 1) {
      user.streakCount = (user.streakCount || 0) + 1;
    } else {
      user.streakCount = 1;
    }
  }

  user.longestStreak = Math.max(user.longestStreak || 0, user.streakCount || 0);
  user.lastActivityDate = today.toDate();

  return {
    streakCount: user.streakCount,
    longestStreak: user.longestStreak,
  };
}

function applyTaskCompletion({
  user,
  difficulty = 'medium',
  queue,
  queueNowEmpty = false,
}) {
  const unlockedBadges = [];
  const baseXp = XP_BY_DIFFICULTY[difficulty] || XP_BY_DIFFICULTY.medium;
  const baseCoins = COINS_BY_DIFFICULTY[difficulty] || COINS_BY_DIFFICULTY.medium;

  if (!user.stats) {
    user.stats = {};
  }

  user.stats.completedTasks = (user.stats.completedTasks || 0) + 1;

  let totalXpGain = baseXp;
  let totalCoinsGain = baseCoins;

  user.xp = (user.xp || 0) + baseXp;
  user.coins = (user.coins || 0) + baseCoins;

  if (queueNowEmpty) {
    user.xp += QUEUE_EMPTY_BONUS.xp;
    user.coins += QUEUE_EMPTY_BONUS.coins;
    totalXpGain += QUEUE_EMPTY_BONUS.xp;
    totalCoinsGain += QUEUE_EMPTY_BONUS.coins;

    if (queue === 'deep') {
      user.stats.deepWorkClears = (user.stats.deepWorkClears || 0) + 1;
      if (user.stats.deepWorkClears === 1) {
        ensureBadge(user, 'Deep Work Initiate', unlockedBadges);
      }
      if (user.stats.deepWorkClears === 10) {
        ensureBadge(user, 'Deep Work Champion', unlockedBadges);
      }
    }

    if (queue === 'admin') {
      user.stats.adminClears = (user.stats.adminClears || 0) + 1;
      if (user.stats.adminClears === 1) {
        ensureBadge(user, 'Admin Accelerator', unlockedBadges);
      }
      if (user.stats.adminClears === 10) {
        ensureBadge(user, 'Operations Virtuoso', unlockedBadges);
      }
    }
  }

  if (user.stats.completedTasks === 1) {
    ensureBadge(user, 'First Task Done', unlockedBadges);
  }
  if (user.stats.completedTasks === 25) {
    ensureBadge(user, 'Momentum Keeper', unlockedBadges);
  }
  if ((user.coins || 0) >= 200) {
    ensureBadge(user, 'Coin Collector', unlockedBadges);
  }

  const previousLevel = user.level || 1;
  const newLevel = calculateLevel(user.xp || 0);
  user.level = newLevel;

  const streakInfo = updateStreak(user);

  return {
    xpGain: totalXpGain,
    coinsGain: totalCoinsGain,
    levelUp: newLevel > previousLevel,
    unlockedBadges,
    streak: streakInfo,
  };
}

module.exports = {
  XP_BY_DIFFICULTY,
  COINS_BY_DIFFICULTY,
  QUEUE_EMPTY_BONUS,
  calculateLevel,
  applyTaskCompletion,
};
