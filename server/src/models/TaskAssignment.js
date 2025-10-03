const mongoose = require('mongoose');

const taskAssignmentSchema = new mongoose.Schema(
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
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      required: true,
      index: true,
    },
    block: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ScheduleBlock',
      required: true,
      index: true,
    },
    dateKey: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    start: {
      type: Date,
      required: true,
    },
    end: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

taskAssignmentSchema.index({ user: 1, profileId: 1, block: 1, dateKey: 1 });
taskAssignmentSchema.index({ user: 1, profileId: 1, task: 1, dateKey: 1 });

module.exports = mongoose.model('TaskAssignment', taskAssignmentSchema);



