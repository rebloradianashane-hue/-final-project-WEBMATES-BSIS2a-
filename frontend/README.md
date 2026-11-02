# AtudTA Wet Market Platform

## Run locally

The Express backend serves this frontend and the API from the same local address. First make sure `backend/.env` contains a valid `MONGO_URI` for your MongoDB database. Keep that file private.

In VS Code, open a terminal and run:

```powershell
cd "D:\final project\backend"
npm start
```

When the terminal reports that MongoDB connected and the server is running, open `http://localhost:5000` in Chrome. The root page redirects to the login page. Signup and login are sent to the backend; new accounts are saved in MongoDB, and passwords are stored as scrypt hashes rather than plain text.

Do not open the HTML files with `file://` or use Live Server for this integrated setup: use the URL served by Express so the frontend can reach its `/api` endpoints on the same origin.

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

The backend keeps API sessions in memory for 24 hours, so sign in again after restarting the server. Customer orders, reviews, and cart contents still use browser storage; only product inventory and stock reservations are connected to MongoDB.