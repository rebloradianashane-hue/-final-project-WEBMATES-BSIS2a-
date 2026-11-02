const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
    productID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    vendorID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    productName: {
        type: String,
        required: true
    },
    vendorName: {
        type: String,
        required: true
    },
    businessId: {
        type: String,
        required: true
    },
    stockUnit: {
        type: String,
        enum: ['piece', 'kg'],
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 0.01
    },
    price: {
        type: Number,
        required: true,
        min: 0
    }
}, { _id: false });

const orderSchema = new mongoose.Schema({
    orderNumber: {
        type: String,
        required: true
    },
    customerID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    customerName: {
        type: String,
        required: true
    },
    address: {
        type: String,
        required: true,
        trim: true
    },
    items: {
        type: [orderItemSchema],
        required: true,
        validate: items => items.length > 0
    },
    itemsSubtotal: {
        type: Number,
        required: true,
        min: 0
    },
    deliveryFee: {
        type: Number,
        required: true,
        default: 58,
        min: 0
    },
    totalAmount: {
        type: Number,
        required: true,
        min: 0
    },
    paymentStatus: {
        type: String,
        required: true
    },
    paymentMethod: {
        type: String,
        enum: ['Cash on Delivery', 'GCash', 'Maya'],
        required: true
    },
    orderStatus: {
        type: String,
        enum: ['Pending', 'Packed', 'Out for Delivery', 'Delivered'],
        default: 'Pending',
        required: true
    },
    courierID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    courierName: {
        type: String,
        default: 'Unassigned'
    },
    declinedBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    packedBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    pickupAt: {
        type: Date,
        default: null
    },
    estimatedDeliveryAt: {
        type: Date,
        default: null
    },
    deliveryConfirmedAt: {
        type: Date,
        default: null
    }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);