const express = require('express');
const router = express.Router();

// POST: Register / Create a user
router.post('/register', async (req, res) => {
    try {
        const { name, contactNumber, password, userRole } = req.body;

        if (!name || !contactNumber || !password || !userRole) {
            return res.status(400).json({ error: 'All fields are required (name, contactNumber, password, userRole).' });
        }

        // Action: Save user to DB (e.g., await User.create({ name, contactNumber, password, userRole }))
        
        res.status(201).json({
            message: 'User created successfully',
            user: { name, contactNumber, userRole } // Avoid returning passwords in response
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;