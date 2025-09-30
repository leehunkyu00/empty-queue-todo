const CoinLog = require('../models/CoinLog');
const User = require('../models/User');
const { listProfiles, findProfile, getPrimaryProfile } = require('../utils/profile');

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

async function listTransactions(req, res) {
  try {
    const userId = req.auth.userId;
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));

    const userDoc = await User.findById(userId).lean();
    if (!userDoc) {
      return res.status(404).json({ message: 'User not found' });
    }

    const activeProfile = getActiveProfile(userDoc, req.query.profileId);
    if (!activeProfile) {
      return res.status(400).json({ message: 'No household profiles available' });
    }

    const [transactions, aggregate] = await Promise.all([
      CoinLog.find({ user: userId, profileId: activeProfile.profileId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
      CoinLog.aggregate([
        { $match: { user: userDoc._id, profileId: activeProfile.profileId } },
        { $group: { _id: null, totalSpent: { $sum: '$amount' } } },
      ]),
    ]);

    const totalSpent = aggregate.length > 0 ? aggregate[0].totalSpent : 0;

    return res.json({
      transactions,
      summary: {
        totalSpent,
        balance: userDoc.coins || 0,
      },
      activeProfile: sanitizeActiveProfile(userDoc, activeProfile),
    });
  } catch (error) {
    console.error('listTransactions error:', error);
    return res.status(500).json({ message: 'Failed to load coin usage' });
  }
}

async function createSpend(req, res) {
  try {
    const userId = req.auth.userId;
    const { amount, memo, profileId } = req.body;

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ message: 'Amount must be greater than zero' });
    }

    const userDoc = await User.findById(userId);
    if (!userDoc) {
      return res.status(404).json({ message: 'User not found' });
    }

    const activeProfile = getActiveProfile(userDoc, profileId);
    if (!activeProfile) {
      return res.status(400).json({ message: 'Profile not found for coin usage' });
    }

    const currentCoins = userDoc.coins || 0;
    if (currentCoins < parsedAmount) {
      return res.status(400).json({ message: 'Not enough coins available' });
    }

    userDoc.coins = currentCoins - parsedAmount;
    await userDoc.save();

    const entry = await CoinLog.create({
      user: userDoc._id,
      profileId: activeProfile.profileId,
      profileName: activeProfile.name,
      amount: parsedAmount,
      memo,
    });

    return res.status(201).json({
      transaction: entry,
      balance: userDoc.coins,
      activeProfile: sanitizeActiveProfile(userDoc, activeProfile),
    });
  } catch (error) {
    console.error('createSpend error:', error);
    return res.status(500).json({ message: 'Failed to record coin usage' });
  }
}

module.exports = {
  listTransactions,
  createSpend,
};
