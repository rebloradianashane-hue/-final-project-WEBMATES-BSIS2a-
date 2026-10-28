require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose'); 
const cors = require('cors');           
const helmet = require('helmet');       
const xss = require('xss-clean');       
const rateLimit = require('express-rate-limit'); 

const app = express();

// ==========================================
// STEP 1: SECURITY & MIDDLEWARE SETUP
// ==========================================

// 1. HTTP Security Headers (Protects against clickjacking, sniffing, etc.)
app.use(helmet());                      

// 2. Cross-Origin Resource Sharing (Allows Live Server frontend to send requests)
app.use(cors());                        

// 3. Body Parser (Must be before XSS sanitizer to parse JSON input first)
app.use(express.json()); 

// 4. XSS Prevention (Sanitizes user input in req.body, req.query, and req.params)
app.use(xss());                         

// 5. STEP 8: Anti-Brute Force Rate Limiting
const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 5,                  // Max 5 requests per minute
  message: { 
    success: false, 
    message: 'Too many requests, try again later' 
  }
});

// Apply rate limiter to all authentication endpoints
app.use('/api/register', authLimiter);
app.use('/api/users', authLimiter);
app.use('/api/auth/login', authLimiter); // 👈 Added for Step 8 compliance

// ==========================================
// STEP 2: DATABASE CONNECTION
// ==========================================
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://webmates:webmates@final-projectwebmates-b.8wrzsvo.mongodb.net/';

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB successfully!'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// ==========================================
// STEP 3: ROUTE MAPPINGS
// ==========================================
const registerRoutes = require('./routes/registerRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const userRoutes = require('./routes/userRoutes');
const productsRoutes = require('./routes/productsRoutes');
const deliveryRoutes = require('./routes/deliveryRoutes');
const orderRoutes = require('./routes/orderRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

app.use('/api/register', registerRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/deliveries', deliveryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);

app.get('/', (req, res) => {
  res.send('Full Multi-Route Application API is running...');
});

// ==========================================
// STEP 4: SERVER INITIALIZATION
// ==========================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running smoothly on port ${PORT}`);
});