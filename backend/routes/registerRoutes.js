const express = require('express');
const router = express.Router();

// POST: Handles sign up creation logic
router.post('/', async (req, res) => {
    try {
        const { name, address, role, password, contactNumber } = req.body;

        // Validation rule check
        if (!name || !address || !role || !password || !contactNumber) {
            return res.status(400).json({ 
                error: 'Registration failed. Make sure name, address, role, password, and contactNumber are sent.' 
            });
        }

        // Action: Encrypt password and save user account context to your database here

        res.status(201).json({
            message: 'User account registered successfully',
            account: { name, address, role, contactNumber }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;