const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    queue: {
      type: String,
      enum: ['deep', 'admin'],
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'cancelled', 'archived'],
      default: 'pending',
      index: true,
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium',
    },
    priority: {
      type: Number,
      default: 0,
    },
    order: {
      type: Number,
      default: 0,
    },
    completedAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
    archivedAt: {
      type: Date,
    },
    scheduledStart: {
      type: Date,
    },
    scheduledEnd: {
      type: Date,
    },
    scheduledDateKey: {
      type: String,
      trim: true,
    },
    assignedProfileId: {
      type: String,
      required: true,
    },
    assignedProfileName: {
      type: String,
      required: true,
    },
    completionSnapshot: {
      type: {
        xpAwarded: { type: Number, default: 0 },
        coinsAwarded: { type: Number, default: 0 },
        queueEmptyBonusApplied: { type: Boolean, default: false },
      },
      default: null,
    },
    scheduledBlock: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ScheduleBlock',
    },
  },
  {
    timestamps: true,
  }
);

taskSchema.index({ user: 1, queue: 1, order: 1 });
taskSchema.index({ user: 1, assignedProfileId: 1, scheduledStart: 1 });
taskSchema.index({ user: 1, assignedProfileId: 1, scheduledDateKey: 1 });

taskSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Task', taskSchema);
