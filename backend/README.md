# AtudTA Backend

The backend is an Express API backed by MongoDB. It handles account registration and login, product inventory, orders, payments, deliveries, and reviews.

## Run locally

1. Create `backend/.env` with a MongoDB connection string:

   ```dotenv
   MONGO_URI=mongodb://127.0.0.1:27017/atudta
   PORT=5000
   ```

   Use your actual MongoDB URI and keep `.env` private.

2. From the repository root, install and start the backend:

   ```powershell
   cd backend
   npm install
   npm start
   ```

The API listens on port `5000` by default. The frontend calls it from `http://localhost:5000` when served from localhost.

## API routes

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/register` | Register a customer, vendor, or rider |
| `POST` | `/api/auth/login` | Sign in and receive a session token |
| `GET` | `/api/products` | List products |
| `POST` | `/api/products` | Create a product |
| `POST` | `/api/products/add` | Create a product (alternate route) |
| `PUT` | `/api/products/:id` | Update a product |
| `DELETE` | `/api/products/:id` | Delete a product |
| `POST` | `/api/products/reserve-stock` | Reserve product stock for an order |
| `POST` | `/api/orders/place` | Place an order |
| `GET` | `/api/orders` | List orders |
| `PUT` | `/api/orders/:id/accept` | Accept an order or delivery |
| `PUT` | `/api/orders/:id/decline` | Decline an order or delivery |
| `PUT` | `/api/orders/:id/status` | Update order status |
| `POST` | `/api/reviews/submit` | Submit a product review |
| `GET` | `/api/reviews` | List reviews |
| `PUT` / `DELETE` | `/api/reviews/:id` | Update or delete a review |
| `POST` | `/api/payments/process` | Process and save a payment record |
| `GET` | `/api/payments` | List payment records |
| `POST` | `/api/deliveries/track` | Create delivery tracking information |
| `GET` | `/api/deliveries` | List delivery records |
| `PUT` / `DELETE` | `/api/deliveries/:id` | Update or delete a delivery |

Routes that require a signed-in account expect the session token returned by registration or login in the `Authorization` header.

## Backend structure

- `server.js` configures middleware, mounts API routes, and connects to MongoDB.
- `routes/` contains the API route handlers.
- `models/` defines MongoDB collections with Mongoose.
- `middleware/sessionAuth.js` creates and validates API sessions.
- `utils/account.js` handles password hashing and public account data.
