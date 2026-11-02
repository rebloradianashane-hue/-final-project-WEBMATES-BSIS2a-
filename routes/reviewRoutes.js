const express = require('express');
const router = express.Router();
const Review = require('../models/review'); // Ensure lowercase 'review' matches your file name

// 1. POST: Submit a product evaluation review
router.post('/submit', async (req, res) => {
    try {
        const { customerID, productName, comments } = req.body;
        if (!customerID || !productName || !comments) {
            return res.status(400).json({ error: 'All fields are required.' });
        }
        const newReview = new Review({ customerID, productName, comments });
        const savedReview = await newReview.save();
        res.status(201).json({ message: 'Review saved completely', review: savedReview });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. GET: Retrieve all product evaluations
router.get('/', async (req, res) => {
    try {
        const reviews = await Review.find();
        res.status(200).json(reviews);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. PUT: Update comments on an evaluation by ID
router.put('/:id', async (req, res) => {
    try {
        const updatedReview = await Review.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedReview) return res.status(404).json({ error: 'Review evaluation asset not found' });
        res.status(200).json({ message: 'Review comments updated successfully', review: updatedReview });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4. DELETE: Drop a review entry by ID
router.delete('/:id', async (req, res) => {
    try {
        const deletedReview = await Review.findByIdAndDelete(req.params.id);
        if (!deletedReview) return res.status(404).json({ error: 'Review not found' });
        res.status(200).json({ message: 'Product evaluation dropped from database' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;