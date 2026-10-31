const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const User = require('../models/user'); 
const protectRoute = require('../middleware/authMiddleware'); // Import para sa Step 10: Route Protection

// ==========================================
// 1. POST: Register / Create User Routes
// ==========================================

// Route A: POST /api/users/register (With validation & error handling)
router.post('/register',
  [
    // Step 3: Input Validation rules
    body('name').trim().notEmpty().withMessage('Full name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('contactNumber').trim().notEmpty().withMessage('Contact number is required'),
    
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

      const newUser = new User({ 
        name, 
        contactNumber, 
        email, 
        password, 
        role: userRole || "user", 
        address: "Not Provided Yet" 
      });

      const savedUser = await newUser.save();
      res.status(201).json({ message: 'User created successfully!', user: savedUser });
    } catch (error) {
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
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            return res.status(400).json({ error: 'Valid email is required.' });
        }

        const newUser = new User({
            name,
            email,
            contactNumber,
            password,
            role: userRole || "user",
            address: "Not Provided Yet"
        });

        const savedUser = await newUser.save();
        res.status(201).json({ success: true, message: 'User created successfully!', user: savedUser });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// 2. GET: Fetch all users (GET /api/users)
// ==========================================
router.get('/', async (req, res) => {
    try {
        const users = await User.find();
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// 3. GET: Protected Profile Route (Step 10)
// ==========================================
// Ginagamitan ng `protectRoute` middleware para masuri kung may 'role' header
router.get('/profile', protectRoute, (req, res) => {
    res.status(200).json({ 
        message: 'Welcome to your protected profile!',
        roleHeaderProvided: req.headers.role 
    });
});

// ==========================================
// 4. PUT: Update user by ID (PUT /api/users/:id)
// ==========================================
router.put('/:id', async (req, res) => {
    try {
        const updatedUser = await User.findByIdAndUpdate(
            req.params.id, 
            req.body, 
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
router.delete('/:id', async (req, res) => {
    try {
        const deletedUser = await User.findByIdAndDelete(req.params.id);
        if (!deletedUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(200).json({ message: 'User deleted from database successfully!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;