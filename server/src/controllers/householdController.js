const { randomUUID } = require('crypto');
const User = require('../models/User');

function sanitizeMembers(userDoc) {
  return (userDoc.householdMembers || []).map((member) => ({
    profileId: member.profileId,
    name: member.name,
    role: member.role,
    avatarColor: member.avatarColor,
    focusModePreference: member.focusModePreference,
  }));
}

function createProfileId() {
  return randomUUID().replace(/-/g, '').slice(0, 10);
}

async function listMembers(req, res) {
  try {
    const user = await User.findById(req.auth.userId).lean();
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    return res.json({ members: sanitizeMembers(user) });
  } catch (error) {
    console.error('listMembers error:', error);
    return res.status(500).json({ message: 'Failed to load household members' });
  }
}

async function createMember(req, res) {
  try {
    const { name, avatarColor = '#22c55e', focusModePreference = 'deep' } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }

    const user = await User.findById(req.auth.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if ((user.householdMembers || []).length >= 8) {
      return res.status(400).json({ message: 'Household member limit reached' });
    }

    const newMember = {
      profileId: createProfileId(),
      name,
      role: 'member',
      avatarColor,
      focusModePreference,
    };

    user.householdMembers.push(newMember);
    await user.save();

    return res.status(201).json({ members: sanitizeMembers(user) });
  } catch (error) {
    console.error('createMember error:', error);
    return res.status(500).json({ message: 'Failed to create household member' });
  }
}

async function updateMember(req, res) {
  try {
    const { profileId } = req.params;
    const { name, avatarColor, focusModePreference } = req.body;

    const user = await User.findById(req.auth.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const member = (user.householdMembers || []).find((item) => item.profileId === profileId);
    if (!member) {
      return res.status(404).json({ message: 'Household member not found' });
    }

    if (name !== undefined) member.name = name;
    if (avatarColor !== undefined) member.avatarColor = avatarColor;
    if (focusModePreference !== undefined) member.focusModePreference = focusModePreference;

    await user.save();

    return res.json({ members: sanitizeMembers(user) });
  } catch (error) {
    console.error('updateMember error:', error);
    return res.status(500).json({ message: 'Failed to update household member' });
  }
}

async function deleteMember(req, res) {
  try {
    const { profileId } = req.params;

    const user = await User.findById(req.auth.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const member = (user.householdMembers || []).find((item) => item.profileId === profileId);
    if (!member) {
      return res.status(404).json({ message: 'Household member not found' });
    }

    if (member.role === 'primary') {
      return res.status(400).json({ message: 'Cannot remove the primary member' });
    }

    user.householdMembers = user.householdMembers.filter((item) => item.profileId !== profileId);
    await user.save();

    return res.json({ members: sanitizeMembers(user) });
  } catch (error) {
    console.error('deleteMember error:', error);
    return res.status(500).json({ message: 'Failed to delete household member' });
  }
}

module.exports = {
  listMembers,
  createMember,
  updateMember,
  deleteMember,
};
