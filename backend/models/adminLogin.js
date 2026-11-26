const mongoose = require('mongoose');

const adminLoginSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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
  collection: 'atudta_admins',
  versionKey: false
});

module.exports = mongoose.model('AdminLogin', adminLoginSchema);
