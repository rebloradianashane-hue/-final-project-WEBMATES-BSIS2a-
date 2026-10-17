const mongoose = require('mongoose');
 
const deliverySchema = new mongoose.Schema({
  // Connects this tracking document directly to a specific Order ID
  orderId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Order', 
    required: true 
  },
  deliveryAddress: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    postalCode: { type: String, required: true }
  },
  courierName: { type: String, default: 'Unassigned' },
  deliveryStatus: { 
    type: String, 
    enum: ['processing', 'shipped', 'out-for-delivery', 'delivered', 'cancelled'], 
    default: 'processing' 
  },
  estimatedDeliveryDate: { type: Date }
}, { timestamps: true });
 
// Export it as 'Delivery'
module.exports = mongoose.model('Delivery', deliverySchema);