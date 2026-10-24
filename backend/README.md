# WEBMATES Backend

## 1. Overview

The WEBMATES backend is built using Node.js, Express.js, and MongoDB. It handles API requests for user accounts, products, orders, deliveries, payments, and product reviews.

## 2. Routes Implemented

The backend uses Express.js route handlers to process API requests.

| HTTP Method | Endpoint | Description |
|---|---|---|
| POST | `/api/deliveries/track` | Validates delivery tracking information and returns the delivery details. |
| POST | `/api/orders/place` | Validates order details and calculates the items subtotal plus the delivery fee. |
| POST | `/api/payments/process` | Validates payment information and returns the payment details. |
| POST | `/api/products/add` | Validates product details and returns the product information. |
| POST | Depends on the route prefix in `server.js` | Validates registration details, including name, address, role, password, and contact number. |
| POST | `/api/reviews/submit` | Validates product review information and returns the review details, if the review route is registered in `server.js`. |
| POST | `/api/users/register` | Validates user details and returns the user information without the password. |

### Route Notes

- The route prefixes are based on the route mounts in `server.js` and the route files provided.
- The endpoint for `registerRoutes.js` depends on its mount configuration in `server.js`.
- The review endpoint must be registered in `server.js` before it can be accessed.
- The routes currently validate incoming information and return responses.
- The database-saving actions shown in comments have not yet been implemented in the route handlers shared.
- The registration routes are documented separately because they use different request fields.

## 3. Current Models

The `models/` folder contains six Mongoose model files. These define the structure of the data intended for storage in MongoDB.

### 3.1 Delivery Model — `delivery.js`

Defines delivery tracking information.

- `orderID` – References an order in the `Order` collection; required.
- `deliveryAddress` – The delivery destination; required.
- `courierName` – The courier's name; required.
- `deliveryStatus` – The delivery status; allowed values are `pending`, `picked_up`, `in_transit`, `delivered`, and `failed`. Defaults to `pending`.
- `estimatedDeliveryDate` – The estimated delivery date; required.
- `createdAt` and `updatedAt` – Automatically recorded timestamps.

### 3.2 Order Model — `order.js`

Defines customer orders and their items.

- `customerID` – References the customer in the `User` collection; required.
- `vendorID` – References the vendor in the `User` collection; required.
- `items` – An array of ordered products, each containing:
  - `productName` – The product name; required.
  - `quantity` – The quantity ordered; required, with a minimum of `1` and a default of `1`.
  - `price` – The product price; required.
- `deliveryFee` – The delivery fee; required and defaults to `0`.
- `totalAmount` – The total order amount; required and intended to include the items subtotal plus the delivery fee.
- `createdAt` and `updatedAt` – Automatically recorded timestamps.

### 3.3 Payment Model — `payment.js`

Defines payment transaction information.

- `customerID` – References a user in the `User` collection; required.
- `date` – The payment date; required and defaults to the current date and time.
- `amount` – The payment amount; required and must be zero or greater.
- `method` – The payment method; allowed values are `cash`, `credit_card`, `paypal`, and `gcash`.
- `createdAt` and `updatedAt` – Automatically recorded timestamps.

### 3.4 Product Model — `product.js`

Defines product information.

- `vendorID` – References a user in the `User` collection; required.
- `productName` – The product name; required, with extra whitespace trimmed.
- `price` – The product price; required and must be zero or greater.
- `stock` – The available quantity; required, must be zero or greater, and defaults to `0`.
- `createdAt` and `updatedAt` – Automatically recorded timestamps.

### 3.5 Review Model — `review.js`

Defines product review and feedback information.

- `customerID` – References a user in the `User` collection; required.
- `productName` – The reviewed product's name; required, with extra whitespace trimmed.
- `comments` – The customer's feedback; required, with extra whitespace trimmed.
- `createdAt` and `updatedAt` – Automatically recorded timestamps.

### 3.6 User Model — `user.js`

Defines user account information.

- `name` – The user's name; required, with extra whitespace trimmed.
- `address` – The user's address; required.
- `role` – The user's role; allowed values are `customer`, `vendor`, and `courier`. Defaults to `customer`.
- `password` – The user's password; required.
- `contactNumber` – The user's contact number; required, with extra whitespace trimmed.
- `createdAt` and `updatedAt` – Automatically recorded timestamps.

**Security note:** Passwords should be securely hashed before they are stored in the database.

## 4. Database Connection Setup

The backend uses MongoDB for data storage and Mongoose to define models and interact with the database.

The database connection configuration file is located at `config/db.js`.

### Requirements

- Node.js and npm
- A MongoDB database
- A valid MongoDB connection string

### Environment Configuration

1. Configure the MongoDB connection string using the environment variable expected by the connection code, such as `MONGO_URI`.
2. If your connection setup uses environment variables, create a `.env` file inside the `backend/` folder.
3. Keep the connection string and database credentials private.
4. Do not commit `.env` files or passwords to GitHub.

**Important:** Check `server.js` and `config/db.js` to confirm which connection setup is actually used. The environment variable names and connection methods should be consistent.

## 5. How to Run the Server Locally

### Step 1: Open the Backend Directory

Open PowerShell or a terminal in the project repository and navigate to the backend folder:

```bash
cd backend
```

If your terminal is already inside the `backend/` directory, skip this step.

### Step 2: Install Dependencies

Run:

```bash
npm install
```

This installs the packages listed in `package.json`.

### Step 3: Configure the Database

Ensure your MongoDB database is available and your connection string is configured correctly.

### Step 4: Start the Development Server

Run:

```bash
npm run dev
```

The development script uses Nodemon to restart the server when files change.

The server is configured to use port `5000` by default, unless another port is specified through the `PORT` environment variable.

### Step 5: Check the Server

Open this address in your browser:

`http://localhost:5000`

The root route should display a message indicating that the API is running.

## 6. Error Handling

The route handlers use HTTP status codes to communicate request results.

- `201 Created` – The request was processed successfully.
- `400 Bad Request` – Required information is missing or invalid.
- `500 Internal Server Error` – An unexpected server error occurred.

## 7. Security Notes

- Keep database credentials and secrets private.
- Never return passwords in API responses.
- Hash passwords securely before storing them.
- Validate incoming request data.
- Protect routes that require authentication and authorization.
- Never commit `.env` files to GitHub.

## 8. Current Project Status

The backend includes route files for deliveries, orders, payments, products, registration, reviews, and users, as well as six Mongoose models.

The models define the intended structure of the application's data. However, the route handlers shared currently return response data without implementing the corresponding database-saving operations.

This README documents the current routes, model structures, database setup requirements, and local development instructions.
