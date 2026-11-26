const mongoose = require('mongoose');

const adminLoginHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  loggedInAt: {
    type: Date,
    required: true,
    default: Date.now
  }
}, {
  collection: 'atudta_admin_login_history',
  versionKey: false
});

module.exports = mongoose.model('AdminLoginHistory', adminLoginHistorySchema);
