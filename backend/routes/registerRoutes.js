const express = require('express');
const { body, validationResult } = require('express-validator');
const { createAccount, publicAccount } = require('../utils/account');
const { createSession } = require('../middleware/sessionAuth');

const router = express.Router();

router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Full name is required'),
    body('email').trim().isEmail().withMessage('Valid email is required'),
    body('address').trim().notEmpty().withMessage('Address is required'),
    body('contactNumber').trim().matches(/^09\d{9}$/).withMessage('Enter a valid 11-digit mobile number starting with 09'),
    body('role').isIn(['Customer', 'Vendor', 'Rider']).withMessage('Please select a valid account role'),
    body('password')
      .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
      .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
      .matches(/[0-9]/).withMessage('Password must contain at least one number')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
    }

    const { name, email, address, role, password, contactNumber } = req.body;
    const accountDetails = {
      name,
      email,
      address,
      role,
      password,
      contactNumber,
      ...(role === 'Vendor' ? {
        businessRole: req.body.businessRole,
        badgeNumber: req.body.badgeNumber,
        stallNumber: req.body.stallNumber,
        stallName: req.body.stallName
      } : {}),
      ...(role === 'Rider' ? { licenseNumber: req.body.licenseNumber } : {})
    };

    if (role === 'Vendor' &&
        ![accountDetails.businessRole, accountDetails.badgeNumber, accountDetails.stallNumber, accountDetails.stallName]
          .every(value => typeof value === 'string' && value.trim())) {
      return res.status(400).json({ error: 'Complete all vendor account details.' });
    }
    if (role === 'Vendor' && !/^\d{3}-\d{3}-\d{3}$/.test(accountDetails.badgeNumber)) {
      return res.status(400).json({ error: 'Badge number must use the 111-222-333 format.' });
    }
    if (role === 'Rider' && !accountDetails.licenseNumber?.trim()) {
      return res.status(400).json({ error: 'Driver license number is required.' });
    }
    if (role === 'Rider' && !/^[A-Za-z0-9]{12}$/.test(accountDetails.licenseNumber)) {
      return res.status(400).json({ error: 'Driver license number must contain 12 letters and/or numbers.' });
    }

    try {
      const user = await createAccount(accountDetails);
      return res.status(201).json({
        message: 'User account registered successfully',
        user: publicAccount(user),
        sessionToken: createSession(user._id)
      });
    } catch (error) {
      if (error.code === 11000) {
        const duplicateField = Object.keys(error.keyPattern || {})[0];
        const message = duplicateField === 'contactNumber'
          ? 'Contact number already registered.'
          : 'Email already registered.';
        return res.status(409).json({ error: message });
      }

      console.error('Account registration failed:', error);
      return res.status(500).json({ error: 'Could not create the account. Please try again.' });
    }
  }
);

module.exports = router;