const express = require('express');
const router = express.Router();
const User = require('../models/user'); 

// 1. POST: Register a user
router.post('/register', async (req, res) => {
    try {
        const { name, contactNumber, password, userRole } = req.body;
        if (!name || !contactNumber || !password || !userRole) {
            return res.status(400).json({ error: 'All fields are required.' });
        }
        const newUser = new User({ name, contactNumber, password, role: userRole, address: "Not Provided Yet" });
        const savedUser = await newUser.save();
        res.status(201).json({ message: 'User created successfully!', user: savedUser });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. GET: Fetch all users
router.get('/', async (req, res) => {
    try {
        const users = await User.find();
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. PUT: Update a user's details by ID (THIS WAS MISSING)
router.put('/:id', async (req, res) => {
    try {
        const updatedUser = await User.findByIdAndUpdate(
            req.params.id, 
            req.body, 
            { new: true, runValidators: true } // returns the newly modified document back
        );
        if (!updatedUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(200).json({ message: 'User updated successfully!', user: updatedUser });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4. DELETE: Remove a user by ID
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