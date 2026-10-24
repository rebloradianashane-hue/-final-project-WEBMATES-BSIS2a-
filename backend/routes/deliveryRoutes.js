const express = require('express');
const router = express.Router();

// POST: Create or Update delivery track
router.post('/track', async (req, res) => {
    try {
        const { orderID, deliveryAddress, courierName, deliveryStatus, estimatedDeliveryDate } = req.body;

        if (!orderID || !deliveryAddress || !courierName || !deliveryStatus || !estimatedDeliveryDate) {
            return res.status(400).json({ error: 'Missing mandatory tracking parameters.' });
        }

        // Action: Save delivery logging to DB
        
        res.status(201).json({
            message: 'Delivery record created/updated status',
            delivery: { orderID, deliveryAddress, courierName, deliveryStatus, estimatedDeliveryDate }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;