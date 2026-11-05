# AtudTA Wet Market Platform

AtudTA is a web-based wet market platform that connects customers, vendors, and delivery riders. Customers can browse fresh products and place orders, vendors can manage their inventory, and riders can manage deliveries.

## Features

- Customer registration, sign-in, product browsing, cart, and checkout
- Product stock and availability management for vendors
- Order and delivery status tracking for vendors and riders
- Product reviews
- Responsive pages styled with Tailwind CSS

## Project pages

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

Shared application logic is in `app.js`, and additional styles are in `styles.css`.

## Run locally

This folder contains the frontend. The application also needs its API backend to support sign-in, products, orders, payments, deliveries, and reviews.

1. Open this folder in VS Code.
2. Start a static web server for this folder (for example, with the **Live Server** extension).
3. Open the local URL provided by the server, such as `http://127.0.0.1:5500`.
4. Make sure the configured API backend is running and reachable.

The root page redirects to `login.html`. Do not open the HTML files directly with a `file://` URL.

## Configure the API

`app.js` defines `API_BASE_URL`, which should be the backend's base URL without a trailing slash. It is currently configured with a hosted API URL. To use a different backend, update that value and ensure the backend allows requests from the frontend origin through CORS.

The backend is responsible for persistent account and marketplace data. The frontend keeps the shopping cart in browser storage. Do not put database credentials, private tokens, or other secrets in frontend files; frontend code is visible to users.

## Technology

- HTML, CSS, and vanilla JavaScript
- Tailwind CSS, Font Awesome, and Google Fonts loaded from CDNs
- Backend API for authentication and marketplace data
