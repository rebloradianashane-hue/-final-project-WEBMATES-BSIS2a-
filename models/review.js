const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    customerID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    customerName: {
        type: String,
        trim: true,
        default: ''
    },
    orderID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true
    },
    productID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    productName: {
        type: String, 
        required: true,
        trim: true
    },
    comments: {
        type: String,
        required: true,
        trim: true
    }
}, { timestamps: true });

reviewSchema.index(
    { customerID: 1, orderID: 1, productID: 1 },
    {
        unique: true,
        partialFilterExpression: {
            orderID: { $type: 'objectId' },
            productID: { $type: 'objectId' }
        }
    }
);

module.exports = mongoose.model('Review', reviewSchema);