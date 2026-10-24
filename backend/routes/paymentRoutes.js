const express = require('express');
const router = express.Router();

// POST: Log a transaction payment
router.post('/process', async (req, res) => {
    try {
        const { customerID, date, amount, method } = req.body;

        if (!customerID || !date || !amount || !method) {
            return res.status(400).json({ error: 'Payment details are missing necessary values.' });
        }

        // Action: Register payment status to DB
        
        res.status(201).json({
            message: 'Payment tracking entry logged successfully',
            payment: { customerID, date, amount, method }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;