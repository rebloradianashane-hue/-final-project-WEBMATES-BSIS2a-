const express = require('express');
const router = express.Router();
const Order = require('../models/order'); // Double-check that your model file casing matches lowercase 'order'

// 1. POST: Place a new order
router.post('/place', async (req, res) => {
    try {
        const { 
            customerID, 
            vendorID, 
            courierID, 
            items, 
            deliveryFee, 
            paymentStatus, 
            paymentMethod 
        } = req.body;

        
        if (!customerID || !vendorID || !items || !Array.isArray(items) || deliveryFee === undefined) {
            return res.status(400).json({ error: 'Missing mandatory parameters (customerID, vendorID, items, or deliveryFee).' });
        }

        
        let itemsSubtotal = items.reduce((sum, item) => {
            return sum + (Number(item.price) * (item.quantity || 1));
        }, 0);

        let calculatedTotal = itemsSubtotal + Number(deliveryFee);

        
        const newOrder = new Order({
            customerID,
            vendorID,
            courierID: courierID || null, // Optional until assigned to a driver
            items: items.map(item => ({
                productName: item.productName,
                quantity: item.quantity || 1,
                price: item.price
            })),
            deliveryFee,
            totalAmount: calculatedTotal, // Saves computed equation outcome
            paymentStatus: paymentStatus || 'pending',
            paymentMethod: paymentMethod || 'cash'
        });

        const savedOrder = await newOrder.save();

        res.status(201).json({
            message: 'Order created successfully!',
            order: savedOrder
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. GET: Retrieve all orders
router.get('/', async (req, res) => {
    try {
        const orders = await Order.find();
        res.status(200).json(orders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. PUT: Update order parameters or status trackers by ID
router.put('/:id', async (req, res) => {
    try {
        const updatedOrder = await Order.findByIdAndUpdate(
            req.params.id, 
            req.body, 
            { new: true, runValidators: true }
        );
        if (!updatedOrder) return res.status(404).json({ error: 'Order document instance not found.' });
        
        res.status(200).json({ message: 'Order parameters adjusted.', order: updatedOrder });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4. DELETE: Remove an order by ID
router.delete('/:id', async (req, res) => {
    try {
        const deletedOrder = await Order.findByIdAndDelete(req.params.id);
        if (!deletedOrder) return res.status(404).json({ error: 'Order document instance not found.' });
        
        res.status(200).json({ message: 'Order dropped from records successfully.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;