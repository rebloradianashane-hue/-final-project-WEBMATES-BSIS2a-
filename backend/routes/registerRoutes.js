const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');

// POST: /api/register
router.post(
  '/',
  [
    // Step 3: Input Validation
    body('name').trim().notEmpty().withMessage('Full name is required'),    // Require a valid email address for this registration endpoint.
    body('email').trim().isEmail().withMessage('Valid email is required'),
    body('address').trim().notEmpty().withMessage('Address is required'),
    body('contactNumber').trim().notEmpty().withMessage('Contact number is required'),
    body('role').trim().notEmpty().withMessage('Role is required'),

    // Step 7: Password Strengthening
    body('password')
      .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
      .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
      .matches(/[0-9]/).withMessage('Password must contain at least one number')
  ],
  async (req, res) => {
    // Step 4: Handle Validation Errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: errors.array()[0].msg, // Sends primary error string to frontend alert
        errors: errors.array() 
      });
    }

    try {
      const { name, email, address, role, password, contactNumber } = req.body;

      // Save user account logic / database operations go here

      res.status(201).json({
        message: 'User account registered successfully',
        account: { name, email: email.toLowerCase(), address, role, contactNumber }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

module.exports = router;