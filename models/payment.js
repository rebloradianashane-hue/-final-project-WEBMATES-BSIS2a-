<<<<<<< HEAD:models/payment.js
const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    orderID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order'
    },
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
        enum: ['cash', 'credit_card', 'paypal', 'gcash', 'Cash on Delivery', 'GCash', 'Maya']
    },
    paymentStatus: {
        type: String,
        enum: ['Pending COD', 'Paid Digital'],
        default: undefined
    }
}, { timestamps: true });

paymentSchema.index(
    { orderID: 1 },
    { unique: true, partialFilterExpression: { orderID: { $type: 'objectId' } } }
);

module.exports = mongoose.model('Payment', paymentSchema);
=======
>>>>>>> be579441303c13f4d9e48809ffbac9e73f17323b:backend/models/payment.js
