function listProfiles(userDoc) {
  return (userDoc?.householdMembers || []).map((member) => ({
    profileId: member.profileId,
    name: member.name,
    role: member.role,
    avatarColor: member.avatarColor,
    focusModePreference: member.focusModePreference,
  }));
}

function findProfile(userDoc, profileId) {
  if (!profileId) return null;
  const members = userDoc?.householdMembers || [];
  return members.find((member) => member.profileId === profileId) || null;
}

function requireProfile(userDoc, profileId) {
  const profile = findProfile(userDoc, profileId);
  if (!profile) {
    const error = new Error('Profile not found');
    error.status = 404;
    throw error;
  }
  return profile;
}

function getPrimaryProfile(userDoc) {
  const members = userDoc?.householdMembers || [];
  if (members.length === 0) {
    return null;
  }
  return members.find((member) => member.role === 'primary') || members[0];
}

module.exports = {
  listProfiles,
  findProfile,
  requireProfile,
  getPrimaryProfile,
};
