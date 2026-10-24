const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    vendorID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // References the User model (with vendor role)
        required: true
    },
    productName: {
        type: String,
        required: true,
        trim: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    stock: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);