const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const User = require('../models/user'); 
const protectRoute = require('../middleware/authMiddleware'); // Import para sa Step 10: Route Protection
const { createAccount, publicAccount } = require('../utils/account');
const { requireSession, revokeUserSessions } = require('../middleware/sessionAuth');

// ==========================================
// 1. POST: Register / Create User Routes
// ==========================================

// Route A: POST /api/users/register (With validation & error handling)
router.post('/register',
  [
    // Step 3: Input Validation rules
    body('name').trim().notEmpty().withMessage('Full name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('contactNumber').trim().matches(/^09\d{9}$/).withMessage('Enter a valid 11-digit mobile number starting with 09'),
    
    // Step 7: Password Strengthening rules
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
        error: errors.array()[0].msg, // Primary error for frontend alerts
        errors: errors.array() 
      });
    }

    try {
      const { name, contactNumber, password, userRole, email } = req.body;
      const role = normalizeRole(userRole);
      const savedUser = await createAccount({
        name, contactNumber, email, password, role, address: req.body.address || 'Not Provided Yet'
      });
      res.status(201).json({ message: 'User created successfully!', user: publicAccount(savedUser) });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({ error: 'Email or contact number already registered.' });
      }
      res.status(500).json({ error: error.message });
    }
}
);

// Route B: POST /api/users (Standard RESTful creation)
router.post('/', async (req, res) => {
    try {
        const { name, email, password, contactNumber, userRole } = req.body;
        
        // Require email here too so the REST signup route matches the other signup flows.
        if (!name || !email || !password || !contactNumber) {
            return res.status(400).json({ error: 'Name, email, contact number, and password are required.' });
        }
        if (!/^09\d{9}$/.test(contactNumber.trim())) {
            return res.status(400).json({ error: 'Enter a valid 11-digit mobile number starting with 09.' });
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            return res.status(400).json({ error: 'Valid email is required.' });
        }

        const role = normalizeRole(userRole);
        const newUser = await createAccount({
            name,
            email,
            contactNumber,
            password,
            role,
            address: req.body.address || "Not Provided Yet"
        });

        res.status(201).json({ success: true, message: 'User created successfully!', user: publicAccount(newUser) });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ success: false, error: 'Email or contact number already registered.' });
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// 2. GET: Fetch all users (GET /api/users)
// ==========================================
router.get('/', async (req, res) => {
    try {
        const users = await User.find({ deletedAt: null });
        res.status(200).json(users.map(publicAccount));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// 3. GET: Protected Profile Route (Step 10)
// ==========================================
// Ginagamitan ng protectRoute middleware para masuri kung may 'role' header
router.get('/profile', protectRoute, (req, res) => {
    res.status(200).json({ 
        message: 'Welcome to your protected profile!',
        roleHeaderProvided: req.headers.role 
    });
});

// ==========================================
// 4. PUT: Update user by ID (PUT /api/users/:id)
// ==========================================
router.put('/:id', requireSession, async (req, res) => {
    if (String(req.authUser._id) !== req.params.id) {
        return res.status(403).json({ error: 'You can only update your own account.' });
    }

    const editableFields = [
        'name', 'contactNumber', 'address', 'businessRole',
        'badgeNumber', 'stallNumber', 'stallName', 'licenseNumber'
    ];
    const body = req.body || {};
    const updates = Object.fromEntries(
        editableFields
            .filter(field => Object.hasOwn(body, field))
            .map(field => [field, body[field]])
    );
    try {
        const updatedUser = await User.findOneAndUpdate(
            { _id: req.params.id, deletedAt: null },
            updates,
            { new: true, runValidators: true }
        );
        if (!updatedUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(200).json({ message: 'User updated successfully!', user: updatedUser });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// 5. DELETE: Remove user by ID (DELETE /api/users/:id)
// ==========================================
router.delete('/:id', requireSession, async (req, res) => {
    if (String(req.authUser._id) !== req.params.id) {
        return res.status(403).json({ error: 'You can only delete your own account.' });
    }

    try {
        const deletedUser = await User.findByIdAndDelete(req.authUser._id);
        if (!deletedUser) {
            return res.status(404).json({ error: 'Account not found.' });
        }
        revokeUserSessions(req.authUser._id);
        return res.status(200).json({ message: 'Account deleted successfully.' });
    } catch (error) {
        console.error('Could not permanently delete user account:', error);
        return res.status(500).json({ error: 'Could not delete the account. Please try again.' });
    }
});

module.exports = router;

function normalizeRole(role) {
    const roles = {
        customer: 'Customer',
        vendor: 'Vendor',
        rider: 'Rider',
        courier: 'Rider'
    };
    const normalized = roles[String(role || '').toLowerCase()] || 'Customer';
    return normalized;
}

