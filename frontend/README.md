# AtudTA Wet Market Platform

## Run locally

In VS Code, open **Run and Debug** (`Ctrl+Shift+D`), select **Launch AtudTA in Chrome**, and press `F5`. This starts a local server with Python and opens `index.html` in Chrome. Python and Google Chrome must be installed. To open the rider page directly, select **Launch Rider page in Chrome** instead.

Alternatively, serve this folder from one local web server (for example, VS Code Live Server) and open `index.html`. The separate pages share data through browser `localStorage` and the login/checkout handoffs use `sessionStorage`; opening pages directly with `file://` may prevent those flows from working consistently.

## Pages

- `login.html` and `signup.html`: account access and registration
- `customer.html` and `products.html`: customer dashboard, catalog, and cart
- `payment.html`: checkout and payment details
- `reviews.html`: product details and customer reviews
- `vendor.html`: vendor inventory and incoming orders
- `rider.html` and `delivery.html`: rider dashboard and delivery queue
- `index.html`: redirects to the login page

All pages load shared behavior from `app.js` and shared styles from `styles.css`.