const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/user');
const { publicAccount, verifyPassword } = require('../utils/account');
const { createSession } = require('../middleware/sessionAuth');

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
      const user = await User.findOne({ email: req.body.email.trim().toLowerCase() }).select('+password');
      if (!user || !(await verifyPassword(req.body.password, user.password))) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      return res.status(200).json({
        message: 'Login successful.',
        user: publicAccount(user),
        sessionToken: createSession(user._id)
      });
    } catch (error) {
      console.error('Account login failed:', error);
      return res.status(500).json({ error: 'Could not log in. Please try again.' });
    }
  }
);

module.exports = router;
