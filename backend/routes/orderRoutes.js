const express = require('express');
const router = express.Router();

// POST: Process and place an order
router.post('/place', async (req, res) => {
    try {
        const { customerID, vendorID, items, deliveryFee } = req.body;

        if (!customerID || !vendorID || !items || !Array.isArray(items) || deliveryFee === undefined) {
            return res.status(400).json({ error: 'Invalid order structure details provided.' });
        }

        // Calculate total amounts programmatically based on your prompt formula: price + delivery fee
        let itemsSubtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        let calculatedTotal = itemsSubtotal + Number(deliveryFee);

        // Action: Save finalized order to DB
        
        res.status(201).json({
            message: 'Order placed successfully',
            orderDetails: {
                customerID,
                vendorID,
                items,
                deliveryFee,
                totalAmount: calculatedTotal
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;