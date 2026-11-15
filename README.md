# AtudTA (WEBMATES) 🛒🛵

AtudTA is a local wet market web application and delivery platform developed by **WEBMATES** for Polangui, Albay. It bridges local market vendors, customers, and delivery riders through an integrated digital storefront, secure user authentication, order processing, and real-time delivery management.

---

## 🚀 Key Features

- **Role-Based Authentication:** Support for **Customers** (browse products, place orders, review items), **Vendors** (manage stall inventory, pack orders, update product stock/photos), and **Riders** (accept delivery queues, update delivery statuses, view completed deliveries).
- **Secure Backend API:** Built with **Node.js** and **Express**, featuring security headers via **Helmet**, rate limiting for brute-force protection, and XSS sanitization.
- **MongoDB Integration:** Persistent data storage powered by **Mongoose** for users, products, orders, reviews, and delivery archives.
- **Interactive Frontend:** Responsive UI styled with **Tailwind CSS** and dynamic client-side logic handling shopping carts, categories, checkout workflows, and profile management.

---

## 🛠️ Tech Stack

- **Backend:** Node.js, Express, Mongoose, MongoDB Atlas
- **Security & Middleware:** Helmet, Express-Rate-Limit, Express-Validator, Express-XSS-Sanitizer, CORS, Dotenv
- **Frontend:** HTML5, Tailwind CSS, JavaScript (Vanilla), FontAwesome Icons

---

## ⚙️ Installation & Setup

### 1. Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed on your machine.

### 2. Clone the Repository
```bash
git clone [https://github.com/your-username/final-project-webmates.git](https://github.com/your-username/final-project-webmates.git)
cd final-project-webmates
