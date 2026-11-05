const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    customerID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    date: {
        type: Date,
        required: true,
        default: Date.now
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    method: {
        type: String,
        required: true,
        enum: ['cash', 'credit_card', 'paypal', 'gcash'], // Standard payment paths
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);