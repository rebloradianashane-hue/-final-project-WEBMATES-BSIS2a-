const express = require('express');
const router = express.Router();
// Siguraduhing may file na payments.js (o Payments.js) sa loob ng backend/models folder
const Payment = require('../models/payment'); 

// 1. POST: Process a transaction payment
router.post('/process', async (req, res) => {
    try {
        const { customerID, date, amount, method } = req.body;
        if (!customerID || !date || !amount || !method) {
            return res.status(400).json({ error: 'All fields are required.' });
        }
        const newPayment = new Payment({ customerID, date, amount, method });
        const savedPayment = await newPayment.save();
        res.status(201).json({ message: 'Payment logged successfully', payment: savedPayment });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. GET: Retrieve all payment logs
router.get('/', async (req, res) => {
    try {
        // 📌 INAYOS: Binago mula 'payment' papuntang 'Payment' (Capital P)
        const payments = await Payment.find(); 
        res.status(200).json(payments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. PUT: Update a payment log by ID
router.put('/:id', async (req, res) => {
    try {
        const updatedPayment = await Payment.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedPayment) return res.status(404).json({ error: 'Payment log not found' });
        res.status(200).json({ message: 'Payment updated successfully', payment: updatedPayment });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4. DELETE: Remove a payment log by ID
router.delete('/:id', async (req, res) => {
    try {
        const deletedPayment = await Payment.findByIdAndDelete(req.params.id);
        if (!deletedPayment) return res.status(404).json({ error: 'Payment log not found' });
        res.status(200).json({ message: 'Payment tracking entry dropped successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;