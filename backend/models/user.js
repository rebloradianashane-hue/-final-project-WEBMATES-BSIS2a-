const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    address: {
        type: String,
        required: true
    },
    role: {
        type: String,
        required: true,
        enum: ['customer', 'vendor', 'courier'], // Ensures explicit platform definitions
        default: 'customer'
    },
    password: {
        type: String,
        required: true
    },
    contactNumber: {
        type: String,
        required: true,
        trim: true
    }
}, { timestamps: true }); // Automatically manages createdAt and updatedAt fields

module.exports = mongoose.model('User', userSchema);