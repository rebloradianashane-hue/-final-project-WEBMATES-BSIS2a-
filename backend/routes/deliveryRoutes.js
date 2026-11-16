const express = require('express');
const router = express.Router();
const Delivery = require('../models/delivery'); // Ensure lowercase 'delivery' matches your file name

// 1. POST: Create a delivery tracking record
router.post('/track', async (req, res) => {
    try {
        const { orderID, deliveryAddress, courierName, deliveryStatus, estimatedDeliveryDate } = req.body;
        if (!orderID || !deliveryAddress || !courierName || !deliveryStatus || !estimatedDeliveryDate) {
            return res.status(400).json({ error: 'All fields are required.' });
        }
        const newDelivery = new Delivery({ orderID, deliveryAddress, courierName, deliveryStatus, estimatedDeliveryDate });
        const savedDelivery = await newDelivery.save();
        res.status(201).json({ message: 'Delivery tracking created successfully', delivery: savedDelivery });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. GET: Retrieve all delivery records
router.get('/', async (req, res) => {
    try {
        const deliveries = await Delivery.find();
        res.status(200).json(deliveries);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. PUT: Update delivery tracking status by ID
router.put('/:id', async (req, res) => {
    try {
        const updatedDelivery = await Delivery.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedDelivery) return res.status(404).json({ error: 'Delivery record not found' });
        res.status(200).json({ message: 'Delivery updated successfully', delivery: updatedDelivery });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4. DELETE: Remove a delivery record by ID
router.delete('/:id', async (req, res) => {
    try {
        const deletedDelivery = await Delivery.findByIdAndDelete(req.params.id);
        if (!deletedDelivery) return res.status(404).json({ error: 'Delivery record not found' });
        res.status(200).json({ message: 'Delivery tracking record deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
