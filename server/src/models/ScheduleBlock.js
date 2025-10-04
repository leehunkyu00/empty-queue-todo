const mongoose = require('mongoose');

const scheduleBlockSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    profileId: {
      type: String,
      required: true,
      index: true,
    },
    profileName: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['deep', 'admin', 'fixed'],
      required: true,
    },
    title: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    start: {
      type: Date,
      required: true,
    },
    end: {
      type: Date,
      required: true,
    },
    startMinuteOfDay: {
      type: Number,
      min: 0,
      max: 24 * 60,
    },
    endMinuteOfDay: {
      type: Number,
      min: 0,
      max: 24 * 60,
    },
    isRecurring: {
      type: Boolean,
      default: true,
    },
    daysOfWeek: {
      type: [Number],
      default: undefined,
    },
  },
  {
    timestamps: true,
  }
);

scheduleBlockSchema.index({ user: 1, profileId: 1, start: 1 });
scheduleBlockSchema.index({ user: 1, profileId: 1, startMinuteOfDay: 1 });

scheduleBlockSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('ScheduleBlock', scheduleBlockSchema);
