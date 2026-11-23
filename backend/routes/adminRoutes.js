const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/user');
const Product = require('../models/product');
const Order = require('../models/order');
const Review = require('../models/review');
const Delivery = require('../models/delivery');
const Payment = require('../models/payment');
const { requireSession, revokeUserSessions } = require('../middleware/sessionAuth');
const { requireRole } = require('../middleware/authMiddleware');
const { publicAccount } = require('../utils/account');

const router = express.Router();
router.use(requireSession, requireRole('Admin'));

function isSuperAdmin(user) {
  return user.role === 'Admin' && user.adminLevel === 'super_admin';
}

router.get('/dashboard', async (req, res) => {
  try {
    const [
      activeUsers, suspendedUsers, customers, vendors, riders, admins,
      products, orders, reviews, deliveries, payments
    ] = await Promise.all([
      User.countDocuments({ deletedAt: null }),
      User.countDocuments({ deletedAt: { $ne: null } }),
      User.countDocuments({ role: 'Customer', deletedAt: null }),
      User.countDocuments({ role: 'Vendor', deletedAt: null }),
      User.countDocuments({ role: 'Rider', deletedAt: null }),
      User.countDocuments({ role: 'Admin', deletedAt: null }),
      Product.countDocuments(),
      Order.countDocuments(),
      Review.countDocuments(),
      Delivery.countDocuments(),
      Payment.countDocuments()
    ]);
    return res.json({
      currentAdminLevel: req.authUser.adminLevel || 'sub_admin',
      users: { active: activeUsers, suspended: suspendedUsers, customers, vendors, riders, admins },
      products,
      orders,
      reviews,
      deliveries,
      payments
    });
  } catch (error) {
    console.error('Could not load admin dashboard:', error);
    return res.status(500).json({ error: 'Could not load dashboard data.' });
  }
});

router.post('/users', async (req, res) => {
  if (!isSuperAdmin(req.authUser)) {
    return res.status(403).json({ error: 'Only the ATUDTA Super Admin can create Admin Users.' });
  }

  const { name, email, password, contactNumber, address } = req.body || {};
  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Admin name is required.' });
  }
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ error: 'Valid Admin email is required.' });
  }
  if (typeof password !== 'string' || password.length < 6 ||
      !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return res.status(400).json({ error: 'Password must have at least 6 characters, one uppercase letter, and one number.' });
  }
  if (typeof contactNumber !== 'string' || !/^09\d{9}$/.test(contactNumber.trim())) {
    return res.status(400).json({ error: 'Enter a valid 11-digit Admin mobile number starting with 09.' });
  }
  if (typeof address !== 'string' || !address.trim()) {
    return res.status(400).json({ error: 'Admin address is required.' });
  }

  try {
    const { createAccount } = require('../utils/account');
    const adminUser = await createAccount({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      contactNumber: contactNumber.trim(),
      address: address.trim(),
      role: 'Admin',
      adminLevel: 'sub_admin',
      createdBy: req.authUser._id
    });
    return res.status(201).json({
      message: `Admin user ${adminUser.email} was created successfully.`,
      user: publicAccount(adminUser)
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Email or contact number is already registered.' });
    }
    console.error('Could not create Admin User:', error);
    return res.status(500).json({ error: 'Could not create the Admin User account.' });
  }
});

router.get('/users', async (req, res) => {
  try {
    let users;
    if (isSuperAdmin(req.authUser)) {
      users = await User.find().populate('createdBy', 'name email').sort({ createdAt: -1 });
    } else {
      users = await User.find({ role: { $ne: 'Admin' } }).sort({ createdAt: -1 });
    }
    return res.json(users.map(publicAccount));
  } catch (error) {
    console.error('Could not load admin users:', error);
    return res.status(500).json({ error: 'Could not load users.' });
  }
});

router.patch('/users/:id/status', async (req, res) => {
  const { suspended } = req.body || {};
  if (typeof suspended !== 'boolean') {
    return res.status(400).json({ error: 'Suspended must be true or false.' });
  }
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid user ID.' });
  }
  if (String(req.authUser._id) === req.params.id) {
    return res.status(400).json({ error: 'You cannot suspend your own admin account.' });
  }

  try {
    const target = await User.findById(req.params.id);
    if (!target) {
      return res.status(404).json({ error: 'User not found.' });
    }
    if (target.role === 'Admin' && !isSuperAdmin(req.authUser)) {
      return res.status(403).json({ error: 'Only the ATUDTA Super Admin can manage admin accounts.' });
    }
    if (target.adminLevel === 'super_admin') {
      return res.status(403).json({ error: 'The ATUDTA Super Admin account cannot be suspended.' });
    }
    if (target.role === 'Admin' && isSuperAdmin(req.authUser) &&
        String(target.createdBy || '') !== String(req.authUser._id)) {
      return res.status(403).json({ error: 'You can only manage Admin Users created under your account.' });
    }

    target.deletedAt = suspended ? new Date() : null;
    await target.save();
    return res.json({
      message: suspended ? 'User suspended successfully.' : 'User restored successfully.',
      user: publicAccount(target)
    });
  } catch (error) {
    console.error('Could not update user status:', error);
    return res.status(500).json({ error: 'Could not update user status.' });
  }
});

router.delete('/users/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid user ID.' });
  }
  if (String(req.authUser._id) === req.params.id) {
    return res.status(400).json({ error: 'You cannot delete your own Super Admin account.' });
  }
  if (!isSuperAdmin(req.authUser)) {
    return res.status(403).json({ error: 'Only the ATUDTA Super Admin can delete Admin Users.' });
  }

  try {
    const target = await User.findById(req.params.id);
    if (!target) {
      return res.status(404).json({ error: 'Admin User not found.' });
    }
    if (target.role !== 'Admin' || target.adminLevel !== 'sub_admin') {
      return res.status(403).json({ error: 'Only subordinate Admin Users can be deleted.' });
    }
    if (String(target.createdBy || '') !== String(req.authUser._id)) {
      return res.status(403).json({ error: 'You can only delete Admin Users created under your account.' });
    }

    await User.deleteOne({ _id: target._id });
    revokeUserSessions(target._id);
    return res.json({ message: `Admin User ${target.email} was deleted successfully.` });
  } catch (error) {
    console.error('Could not delete Admin User:', error);
    return res.status(500).json({ error: 'Could not delete the Admin User.' });
  }
});

module.exports = router;
