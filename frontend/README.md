# AtudTA Wet Market Platform

AtudTA is a web-based wet market platform connecting customers, vendors, and delivery riders. Customers can browse products, manage a cart, and place orders; vendors can manage product inventory and orders; riders can accept and update deliveries.

## Features

- Customer registration, sign-in, product browsing, cart, and checkout
- Vendor product stock and availability management
- Shared order and delivery status tracking
- Product reviews
- Responsive pages styled with Tailwind CSS

## Frontend pages

| File | Purpose |
| --- | --- |
| `index.html` | Redirects to the sign-in page |
| `login.html`, `signup.html` | Account access and registration |
| `customer.html` | Customer dashboard and profile |
| `products.html` | Product catalog and shopping cart |
| `payment.html` | Checkout and payment details |
| `reviews.html` | Product details and reviews |
| `vendor.html` | Vendor inventory and order dashboard |
| `rider.html`, `delivery.html` | Rider dashboard and delivery queue |

`app.js` contains shared application logic, and `styles.css` contains additional styles.

## Run locally

The frontend depends on the Express API and MongoDB database in the `backend` folder.

1. Make sure `backend/.env` contains a valid `MONGO_URI`. Keep this file private.
2. From the repository root, start the backend:

   ```powershell
   cd backend
   npm install
   npm start
   ```

3. Open `http://localhost:5000` in a browser. The root page redirects to the sign-in page.

You can also serve the `frontend` folder with a local web server such as VS Code Live Server, provided the configured API is reachable. Do not open the HTML files directly with a `file://` URL.

## API configuration and deployment

The API base URL is configured in `app.js`. If the frontend and backend are deployed separately, set it to the backend Web Service URL (without a trailing slash), then redeploy the frontend. The backend must allow the frontend origin through CORS.

Account and marketplace data are stored by the backend. The shopping cart is kept in browser storage. Do not put database credentials, private tokens, or other secrets in frontend files.

## Technology

- HTML, CSS, and vanilla JavaScript
- Tailwind CSS, Font Awesome, and Google Fonts loaded from CDNs
- Express API with MongoDB for persistent application data
