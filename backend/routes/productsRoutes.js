const express = require('express');
const router = express.Router();

// POST: Add a new product
router.post('/add', async (req, res) => {
    try {
        const { vendorID, productName, price, stock } = req.body;

        if (!vendorID || !productName || price === undefined || stock === undefined) {
            return res.status(400).json({ error: 'All fields are required (vendorID, productName, price, stock).' });
        }

        // Action: Save product to DB
        
        res.status(201).json({
            message: 'Product added successfully',
            product: { vendorID, productName, price, stock }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;