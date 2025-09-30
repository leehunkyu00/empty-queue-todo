const mongoose = require('mongoose');

const statsSchema = new mongoose.Schema(
  {
    completedTasks: { type: Number, default: 0 },
    deepWorkClears: { type: Number, default: 0 },
    adminClears: { type: Number, default: 0 },
    focusSessions: { type: Number, default: 0 },
  },
  { _id: false }
);

const householdMemberSchema = new mongoose.Schema(
  {
    profileId: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ['primary', 'member'],
      default: 'member',
    },
    avatarColor: {
      type: String,
      default: '#3b82f6',
    },
    focusModePreference: {
      type: String,
      enum: ['deep', 'admin'],
      default: 'deep',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    displayName: {
      type: String,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    xp: {
      type: Number,
      default: 0,
      min: 0,
    },
    level: {
      type: Number,
      default: 1,
      min: 1,
    },
    coins: {
      type: Number,
      default: 0,
      min: 0,
    },
    streakCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    longestStreak: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastActivityDate: {
      type: Date,
    },
    badges: {
      type: [String],
      default: [],
    },
    stats: {
      type: statsSchema,
      default: () => ({}),
    },
    householdMembers: {
      type: [householdMemberSchema],
      default: () => [],
    },
  },
  {
    timestamps: true,
  }
);

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
