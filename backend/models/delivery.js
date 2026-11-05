const mongoose = require('mongoose');

const deliverySchema = new mongoose.Schema({
    orderID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true
    },
    deliveryAddress: {
        type: String,
        required: true
    },
    courierName: {
        type: String,
        required: true
    },
    deliveryStatus: {
        type: String,
        required: true,
        enum: ['pending', 'picked_up', 'in_transit', 'delivered', 'failed'],
        default: 'pending'
    },
    estimatedDeliveryDate: {
        type: Date,
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Delivery', deliverySchema);