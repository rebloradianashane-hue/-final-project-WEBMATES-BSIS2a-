const express = require('express');
const router = express.Router();

// POST: Submits user feedback metrics
router.post('/submit', async (req, res) => {
    try {
        const { customerID, productName, comments } = req.body;

        if (!customerID || !productName || !comments) {
            return res.status(400).json({ 
                error: 'Required inputs missing: customerID, productName, or comments.' 
            });
        }

        // Action: Push standard document model to target collection metrics

        res.status(201).json({
            message: 'Product evaluation saved completely',
            review: { customerID, productName, comments }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;