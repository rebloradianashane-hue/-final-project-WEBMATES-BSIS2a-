const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    // Keep email addresses normalized and required across all signup flows.
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
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