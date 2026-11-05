require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose'); 
const cors = require('cors');           
const helmet = require('helmet');       
const { xss } = require('express-xss-sanitizer');
const rateLimit = require('express-rate-limit'); 
const path = require('path');

const app = express();

// ==========================================
// STEP 1: SECURITY & MIDDLEWARE SETUP
// ==========================================

// 1. HTTP Security Headers (Protects against clickjacking, sniffing, etc.)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.tailwindcss.com'],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com', 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://cdnjs.cloudflare.com', 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"]
    }
  }
}));

// 2. Cross-Origin Resource Sharing (Allows Live Server frontend to send requests)
app.use(cors());

// 3. Body Parser (Must be before XSS sanitizer to parse JSON input first)
app.use(express.json({ limit: '2mb' }));

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
const mongoUri = process.env.MONGO_URI;

if (!mongoUri) {
  console.error('MONGO_URI environment variable is required.');
  process.exit(1);
}

// ==========================================
// STEP 3: ROUTE MAPPINGS
// ==========================================
const registerRoutes = require('./routes/registerRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const userRoutes = require('./routes/userRoutes');
const productsRoutes = require('./routes/productRoutes');
const deliveryRoutes = require('./routes/deliveryRoutes');
const orderRoutes = require('./routes/orderRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const authRoutes = require('./routes/authRoutes');

app.use('/api/register', registerRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/deliveries', deliveryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);

app.use(express.static(path.resolve(__dirname, '..', 'phase3')));

// ==========================================
// STEP 3.5: ROOT ROUTE HANDLER (Fixes Cannot GET /)
// ==========================================
app.get('/', (req, res) => {
  res.send('AtudTA Backend API is successfully running and connected to MongoDB!');
});

// ==========================================
// STEP 4: SERVER INITIALIZATION
// ==========================================
const PORT = process.env.PORT || 5000;

mongoose.connect(mongoUri)
  .then(() => {
    console.log('Connected to MongoDB successfully!');
    app.listen(PORT, () => {
      console.log(`Server running smoothly on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
