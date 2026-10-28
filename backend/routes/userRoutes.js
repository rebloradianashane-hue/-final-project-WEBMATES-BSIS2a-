const express = require('express');
const router = express.Router();
const User = require('../models/user'); 

// Route A: POST /api/users/register
router.post('/register', async (req, res) => {
    try {
        const { name, contactNumber, password, userRole, email } = req.body;
        
        // Handle input fields flexibly depending on your schema
        if (!name || !password) {
            return res.status(400).json({ error: 'Name and password are required.' });
        }

        const newUser = new User({ 
            name, 
            contactNumber: contactNumber || "Not Provided", 
            email: email || "no-email@provided.com",
            password, 
            role: userRole || "user", 
            address: "Not Provided Yet" 
        });

        const savedUser = await newUser.save();
        res.status(201).json({ message: 'User created successfully!', user: savedUser });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Route B: POST /api/users (Matches standard RESTful convention)
router.post('/', async (req, res) => {
    try {
        const { name, email, password, contactNumber, userRole } = req.body;
        
        if (!name || (!email && !contactNumber) || !password) {
            return res.status(400).json({ error: 'Name, email/contact, and password are required.' });
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
// 3. PUT: Update user by ID (PUT /api/users/:id)
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
// 4. DELETE: Remove user by ID (DELETE /api/users/:id)
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