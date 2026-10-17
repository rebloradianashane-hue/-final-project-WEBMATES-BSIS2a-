require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const app = express();
connectDB();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('API is running...');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

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