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
    courierID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
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
    },
    pickupAt: {
        type: Date,
        default: null
    },
    deliveredAt: {
        type: Date,
        default: null
    }
}, { timestamps: true });

deliverySchema.index({ orderID: 1 }, { unique: true });

module.exports = mongoose.model('Delivery', deliverySchema);