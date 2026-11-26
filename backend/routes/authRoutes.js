const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/user');
const Admin = require('../models/admin');
const AdminLoginHistory = require('../models/adminLoginHistory');
const { publicAccount, verifyPassword } = require('../utils/account');
const { createSession, requireSession, revokeUserSessions } = require('../middleware/sessionAuth');

const router = express.Router();

router.post(
  '/login',
  [
    body('email').trim().isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    try {
      const email = req.body.email.trim().toLowerCase();
      let accountType = 'admin';
      let user = await Admin.findOne({ email, role: 'Admin', password: { $exists: true } }).select('+password');
      if (!user) {
        accountType = 'user';
        user = await User.findOne({ email }).select('+password');
      }
      if (!user || user.deletedAt || !(await verifyPassword(req.body.password, user.password))) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      if (accountType === 'admin') {
        await AdminLoginHistory.create({
          userId: user._id,
          email: user.email
        });
      }

      return res.status(200).json({
        message: 'Login successful.',
        user: publicAccount(user),
        sessionToken: createSession(user._id, accountType)
      });
    } catch (error) {
      console.error('Account login failed:', error);
      return res.status(500).json({ error: 'Could not log in. Please try again.' });
    }
  }
);

router.put('/profile', requireSession, async (req, res) => {
  const { name, contactNumber, address } = req.body || {};
  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Full name is required.' });
  }
  if (typeof contactNumber !== 'string' || !/^09\d{9}$/.test(contactNumber.trim())) {
    return res.status(400).json({ error: 'Enter a valid 11-digit mobile number starting with 09.' });
  }
  if (typeof address !== 'string' || !address.trim()) {
    return res.status(400).json({ error: 'Complete address is required.' });
  }

  const updates = {
    name: name.trim(),
    contactNumber: contactNumber.trim(),
    address: address.trim()
  };
  if (req.authUser.role === 'Vendor') {
    const { businessRole, badgeNumber, stallNumber, stallName, birNumber } = req.body;
    if (![businessRole, badgeNumber, stallNumber, stallName, birNumber]
      .every(value => typeof value === 'string' && value.trim())) {
      return res.status(400).json({ error: 'Complete all vendor account details, including the BIR number.' });
    }
    if (!/^\d{3}-\d{3}-\d{3}$/.test(badgeNumber.trim())) {
      return res.status(400).json({ error: 'Badge number must use the 111-222-333 format.' });
    }
    Object.assign(updates, {
      businessRole: businessRole.trim(),
      badgeNumber: badgeNumber.trim(),
      stallNumber: stallNumber.trim(),
      stallName: stallName.trim(),
      birNumber: birNumber.trim()
    });
  } else if (req.authUser.role === 'Rider') {
    const { licenseNumber } = req.body;
    if (typeof licenseNumber !== 'string' || !/^[A-Za-z0-9]{12}$/.test(licenseNumber.trim())) {
      return res.status(400).json({ error: 'Driver license number must contain 12 letters and/or numbers.' });
    }
    updates.licenseNumber = licenseNumber.trim();
  }

  try {
    Object.assign(req.authUser, updates);
    await req.authUser.save();
    return res.status(200).json({
      message: 'Profile updated successfully.',
      user: publicAccount(req.authUser)
    });
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.contactNumber) {
      return res.status(409).json({ error: 'Contact number already registered.' });
    }
    console.error('Could not update account profile:', error);
    return res.status(500).json({ error: 'Could not update your profile. Please try again.' });
  }
});

router.delete('/profile', requireSession, async (req, res) => {
  try {
    const Account = req.authAccountType === 'admin' ? Admin : User;
    const deletedUser = await Account.findByIdAndDelete(req.authUser._id);
    if (!deletedUser) {
      return res.status(404).json({ error: 'Account not found.' });
    }
    revokeUserSessions(req.authUser._id, req.authAccountType);
    return res.status(200).json({ message: 'Account deleted successfully.' });
  } catch (error) {
    console.error('Could not delete account:', error);
    return res.status(500).json({ error: 'Could not delete your account. Please try again.' });
  }
});

module.exports = router;