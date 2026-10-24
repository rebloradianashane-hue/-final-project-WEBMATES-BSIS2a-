const express = require('express');
const mongoose = require('mongoose'); // 1. Import Mongoose

const app = express();

app.use(express.json());

// Replace this string with your real MongoDB URI (Local or MongoDB Atlas)
const MONGO_URI = 'mongodb+srv://webmates:webmates@final-projectwebmates-b.8wrzsvo.mongodb.net/';
// 2. Connect to MongoDB
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ Connected to MongoDB successfully!'))
    .catch((err) => console.error('❌ MongoDB connection error:', err));

// Import Routes
const registerRoutes = require('./routes/registerRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const userRoutes = require('./routes/userRoutes');
const productsRoutes = require('./routes/productsRoutes');
const deliveryRoutes = require('./routes/deliveryRoutes');
const orderRoutes = require('./routes/orderRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

// Map Routes
app.use('/api/register', registerRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/deliveries', deliveryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);

// Root Health Route
app.get('/', (req, res) => {
    res.send('Full Multi-Route Application API is running...');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running smoothly on port ${PORT}`);
});