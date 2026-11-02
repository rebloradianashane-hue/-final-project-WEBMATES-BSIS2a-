<<<<<<< HEAD:models/user.js
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
        lowercase: true,
        unique: true
    },
    
    role: {
        type: String,
        required: true,
        enum: ['Customer', 'Vendor', 'Rider'],
        default: 'Customer'
    },
    password: {
        type: String,
        required: true,
        select: false
    },
    contactNumber: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    address: {
        type: String,
        required: true,
        trim: true
    },
    businessRole: { type: String, trim: true },
    badgeNumber: { type: String, trim: true },
    stallNumber: { type: String, trim: true },
    stallName: { type: String, trim: true },
    licenseNumber: { type: String, trim: true }
}, { timestamps: true }); // Automatically manages createdAt and updatedAt fields

module.exports = mongoose.model('User', userSchema);
=======
>>>>>>> be579441303c13f4d9e48809ffbac9e73f17323b:backend/models/user.js
