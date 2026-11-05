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

The frontend depends on the Express API and MongoDB database in the `backend` folder. Configure a valid `MONGO_URI` in `backend/.env` and keep that file private.

1. Start the backend from the repository root:

   ```powershell
   cd backend
   npm install
   npm start
   ```

2. In VS Code, open the `frontend` folder and start it with Live Server (or another static web server).
3. Open the local frontend URL, such as `http://127.0.0.1:5500`. When the frontend host is `localhost` or `127.0.0.1`, API requests are sent to `http://localhost:5000`.

Do not open the HTML files directly with a `file://` URL.

## API configuration and deployment

The API base URL is configured in `app.js`. Local frontend hosts use `http://localhost:5000`; other hosts use the configured hosted API URL. If you deploy to a different backend, update that URL (without a trailing slash) and ensure the backend allows the frontend origin through CORS.

Account and marketplace data are stored by the backend. The shopping cart is kept in browser storage. Do not put database credentials, private tokens, or other secrets in frontend files.

## Technology

- HTML, CSS, and vanilla JavaScript
- Tailwind CSS, Font Awesome, and Google Fonts loaded from CDNs
- Express API with MongoDB for persistent application data
