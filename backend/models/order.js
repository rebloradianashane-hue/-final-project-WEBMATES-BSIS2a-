const mongoose = require('mongoose');
 
const orderSchema = new mongoose.Schema({
  // Connects this order directly to a specific User ID in your database
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  items: [{
    productName: { type: String, required: true },
    quantity: { type: Number, required: true, default: 1 },
    price: { type: Number, required: true }
  }],
  totalAmount: { type: Number, required: true },
  paymentStatus: { 
    type: String, 
    enum: ['pending', 'paid', 'failed'], 
    default: 'pending' 
  }
}, { timestamps: true }); // Automatically adds createdAt and updatedAt timestamps
 
// Export it as 'Order'
module.exports = mongoose.model('Order', orderSchema);