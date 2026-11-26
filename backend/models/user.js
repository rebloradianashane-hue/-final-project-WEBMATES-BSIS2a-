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
        enum: ['Admin', 'Customer', 'Vendor', 'Rider'],
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
    birthdate: {
        type: String,
        trim: true,
        required: function () {
            return this.isNew && this.role !== 'Admin';
        }
    },
    businessRole: { type: String, trim: true },
    badgeNumber: { type: String, trim: true },
    stallNumber: { type: String, trim: true },
    stallName: { type: String, trim: true },
    birNumber: {
        type: String,
        trim: true,
        required: function () {
            return this.role === 'Vendor';
        }
    },
    licenseNumber: { type: String, trim: true },
    adminLevel: {
        type: String,
        enum: ['super_admin', 'sub_admin']
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    deletedAt: { type: Date, default: null }
}, { timestamps: true }); // Automatically manages createdAt and updatedAt fields

module.exports = mongoose.model('User', userSchema);

