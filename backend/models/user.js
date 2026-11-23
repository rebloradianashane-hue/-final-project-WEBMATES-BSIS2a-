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
        enum: ['Customer', 'Vendor', 'Rider', 'Admin'],
        default: 'Customer'
    },
    adminLevel: {
        type: String,
        enum: ['super_admin', 'sub_admin'],
        default: null
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
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
    licenseNumber: { type: String, trim: true },
    deletedAt: { type: Date, default: null }
}, { timestamps: true }); // Automatically manages createdAt and updatedAt fields

module.exports = mongoose.model('User', userSchema);

