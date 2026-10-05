const mongoose = require('mongoose');

const bookmarkSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Bookmark must belong to a user'],
    index: true
  },
  scheme: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Scheme',
    required: [true, 'Bookmark must reference a scheme'],
    index: true
  }
}, {
  timestamps: true
});

bookmarkSchema.index({ user: 1, scheme: 1 }, { unique: true });

module.exports = mongoose.model('Bookmark', bookmarkSchema);
