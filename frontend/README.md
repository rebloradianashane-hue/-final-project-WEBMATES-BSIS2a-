# AtudTA Wet Market Platform

## Run locally

The Express backend serves this frontend and the API from the same local address. First make sure `backend/.env` contains a valid `MONGO_URI` for your MongoDB database. Keep that file private. If you prefer to open the frontend through Live Server on `localhost` or `127.0.0.1`, the app automatically sends API requests to `http://localhost:5000`.

In VS Code, open a terminal and run:

```powershell
cd "D:\final project\backend"
npm start
```

When the terminal reports that MongoDB connected and the server is running, open `http://localhost:5000` in Chrome. The root page redirects to the login page. Signup and login are sent to the backend; new accounts are saved in MongoDB, and passwords are stored as scrypt hashes rather than plain text.

Do not open the HTML files with `file://`; use `http://localhost:5000` or Live Server on localhost so the frontend can reach the backend API.

## Deploying on Render

The backend must be deployed as a Render **Web Service** with a valid `MONGO_URI` environment variable. If the frontend is deployed separately as a **Static Site**, open `app.js` and set `API_BASE_URL` to the backend Web Service URL, for example `https://your-backend.onrender.com` (no trailing slash), then redeploy the frontend. Leave it empty when the backend serves the frontend from the same origin.

The frontend must use the backend service URL, not its own Static Site URL. If login or signup still fails, open the backend service's Render logs and confirm it is running and connected to MongoDB.

## Pages

- `login.html` and `signup.html`: account access and registration
- `customer.html` and `products.html`: customer dashboard, catalog, and cart
- `payment.html`: checkout and payment details
- `reviews.html`: product details and customer reviews
- `vendor.html`: vendor inventory and incoming orders
- `rider.html` and `delivery.html`: rider dashboard and delivery queue
- `index.html`: redirects to the login page

All pages load shared behavior from `app.js` and shared styles from `styles.css`.

Vendors enter each product's stock quantity and choose whether it is measured in pieces or kilograms. Customers see the available stock in the catalog, and placing an order reduces the listed quantity.

Products are stored in the MongoDB `products` collection. The product catalog is loaded from the backend API, and vendor product creation, availability changes, deletion, and customer stock reservations are saved there. After updating the app, sign out and sign in again so the browser receives a server session token. Use the same `MONGO_URI` database in MongoDB Compass; product data previously saved only in browser storage is not automatically copied to MongoDB.

The backend keeps API sessions in memory for 24 hours, so sign in again after restarting the server. Orders and order statuses are stored in MongoDB and shared across customer, vendor, and rider accounts; newly placed orders reserve product stock in the same backend flow. Each new order also creates a payment record in `payments` and a delivery record in `deliveries`; delivery status is updated when a rider accepts, starts, and completes a delivery. When a rider starts delivery, the backend records the pickup date and time and estimates delivery 30 minutes later. Customer reviews are saved to and loaded from the `reviews` collection, and may only be submitted for products in that customer's delivered orders. Cart contents remain in browser storage. Older reviews, orders, and cart contents saved only in browser storage are not migrated automatically.

MongoDB collection names are lowercase and plural (`reviews`, `payments`, and `deliveries`). Make sure MongoDB Compass is connected to the same database named in `backend/.env`'s `MONGO_URI`; records created before this change are not backfilled into the new collections.