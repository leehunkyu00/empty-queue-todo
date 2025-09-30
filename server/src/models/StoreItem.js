const mongoose = require('mongoose');

const storeItemSchema = new mongoose.Schema(
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
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 1,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    archived: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

storeItemSchema.index({ user: 1, profileId: 1, createdAt: -1 });

storeItemSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    delete ret.updatedAt;
    return ret;
  },
});

module.exports = mongoose.model('StoreItem', storeItemSchema);
