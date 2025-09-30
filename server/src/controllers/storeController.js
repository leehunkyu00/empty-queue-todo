const StoreItem = require('../models/StoreItem');
const CoinLog = require('../models/CoinLog');
const User = require('../models/User');
const { getPrimaryProfile, findProfile, listProfiles } = require('../utils/profile');
const { COINS_BY_DIFFICULTY } = require('../utils/gamification');

function resolveActiveProfile(userDoc, requestedProfileId) {
  if (!userDoc) return null;
  if (requestedProfileId) {
    const match = findProfile(userDoc, requestedProfileId);
    if (match) return match;
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

async function listStore(req, res) {
  try {
    const userId = req.auth.userId;
    const userDoc = await User.findById(userId).lean();
    if (!userDoc) {
      return res.status(404).json({ message: 'User not found' });
    }

    const activeProfile = resolveActiveProfile(userDoc, req.query.profileId);
    if (!activeProfile) {
      return res.status(400).json({ message: 'No household profiles available' });
    }

    const [items, purchases] = await Promise.all([
      StoreItem.find({
        user: userId,
        profileId: activeProfile.profileId,
        archived: false,
      })
        .sort({ createdAt: -1 })
        .lean(),
      CoinLog.find({
        user: userId,
        profileId: activeProfile.profileId,
        type: 'spend',
      })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
    ]);

    return res.json({
      items,
      purchases,
      activeProfile: sanitizeProfile(userDoc, activeProfile),
      profiles: listProfiles(userDoc),
      averageReward: Math.round(
        (COINS_BY_DIFFICULTY.easy + COINS_BY_DIFFICULTY.medium + COINS_BY_DIFFICULTY.hard) / 3
      ),
    });
  } catch (error) {
    console.error('listStore error:', error);
    return res.status(500).json({ message: 'Failed to load store' });
  }
}

async function createStoreItem(req, res) {
  try {
    const userId = req.auth.userId;
    const userDoc = await User.findById(userId);
    if (!userDoc) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { profileId, name, description, price } = req.body;

    if (!profileId || !name || !price) {
      return res.status(400).json({ message: 'profileId, name, and price are required' });
    }

    const profile = findProfile(userDoc, profileId);
    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    const item = await StoreItem.create({
      user: userId,
      profileId: profile.profileId,
      profileName: profile.name,
      name: name.trim(),
      description: description?.trim(),
      price: Number(price),
    });

    return res.status(201).json({ item });
  } catch (error) {
    console.error('createStoreItem error:', error);
    return res.status(500).json({ message: 'Failed to create store item' });
  }
}

async function updateStoreItem(req, res) {
  try {
    const userId = req.auth.userId;
    const { itemId } = req.params;
    const { name, description, price } = req.body;

    const item = await StoreItem.findOne({ _id: itemId, user: userId, archived: false });
    if (!item) {
      return res.status(404).json({ message: 'Store item not found' });
    }

    if (name !== undefined) item.name = name.trim();
    if (description !== undefined) item.description = description.trim();
    if (price !== undefined) {
      const numericPrice = Number(price);
      if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
        return res.status(400).json({ message: 'Invalid price value' });
      }
      item.price = numericPrice;
    }

    await item.save();

    return res.json({ item });
  } catch (error) {
    console.error('updateStoreItem error:', error);
    return res.status(500).json({ message: 'Failed to update store item' });
  }
}

async function archiveStoreItem(req, res) {
  try {
    const userId = req.auth.userId;
    const { itemId } = req.params;

    const item = await StoreItem.findOne({ _id: itemId, user: userId, archived: false });
    if (!item) {
      return res.status(404).json({ message: 'Store item not found' });
    }

    item.archived = true;
    await item.save();

    return res.json({ item });
  } catch (error) {
    console.error('archiveStoreItem error:', error);
    return res.status(500).json({ message: 'Failed to archive store item' });
  }
}

async function deleteStoreItem(req, res) {
  try {
    const userId = req.auth.userId;
    const { itemId } = req.params;

    const item = await StoreItem.findOneAndDelete({ _id: itemId, user: userId });
    if (!item) {
      return res.status(404).json({ message: 'Store item not found' });
    }

    return res.json({ message: 'Store item deleted' });
  } catch (error) {
    console.error('deleteStoreItem error:', error);
    return res.status(500).json({ message: 'Failed to delete store item' });
  }
}

async function purchaseItem(req, res) {
  try {
    const userId = req.auth.userId;
    const { itemId } = req.params;
    const userDoc = await User.findById(userId);
    if (!userDoc) {
      return res.status(404).json({ message: 'User not found' });
    }

    const item = await StoreItem.findOne({ _id: itemId, user: userId, archived: false });
    if (!item) {
      return res.status(404).json({ message: 'Store item not found' });
    }

    const profile = findProfile(userDoc, item.profileId);
    if (!profile) {
      return res.status(400).json({ message: 'Assigned profile is no longer available' });
    }

    const price = Number(item.price);
    if (price <= 0) {
      return res.status(400).json({ message: 'Invalid item price' });
    }

    if ((userDoc.coins || 0) < price) {
      return res.status(400).json({ message: 'Not enough coins available' });
    }

    userDoc.coins = (userDoc.coins || 0) - price;
    await userDoc.save();

    const purchase = await CoinLog.create({
      user: userDoc._id,
      profileId: profile.profileId,
      profileName: profile.name,
      amount: price,
      memo: `구매: ${item.name}`,
      storeItemId: item._id,
      storeItemName: item.name,
    });

    return res.json({
      purchase,
      balance: userDoc.coins,
      item,
    });
  } catch (error) {
    console.error('purchaseItem error:', error);
    return res.status(500).json({ message: 'Failed to complete purchase' });
  }
}

module.exports = {
  listStore,
  createStoreItem,
  updateStoreItem,
  archiveStoreItem,
  deleteStoreItem,
  purchaseItem,
};
