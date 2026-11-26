const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    unique: true
  },
  role: {
    type: String,
    required: true,
    enum: ['Admin'],
    default: 'Admin'
  },
  password: {
    type: String,
    required: true,
    select: false
  },
  contactNumber: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  address: {
    type: String,
    required: true,
    trim: true
  },
  adminLevel: {
    type: String,
    enum: ['super_admin', 'sub_admin'],
    default: 'sub_admin'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  collection: 'atudta_admins'
});

module.exports = mongoose.model('Admin', adminSchema);
