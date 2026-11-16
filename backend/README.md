# Backend

The backend is an Express API backed by MongoDB and serves the frontend from the `frontend/` directory.

## Requirements

- Node.js and npm
- A reachable MongoDB database

## Configuration

Create `backend/.env` and set the MongoDB connection string. `PORT` is optional and defaults to `5000`.

```env
MONGO_URI=<your MongoDB connection string>
PORT=5000
```

Keep `.env` private; do not commit database credentials.

## Install and run

The project has one `package.json` at the repository root. From that directory, run:

```powershell
npm install
npm run dev
```

To run without nodemon:

```powershell
npm start
```

The server starts listening only after it connects to MongoDB. When startup succeeds, open `http://localhost:5000` (or the configured port).

## Deploy on Render

Create a Render **Web Service** from the repository root. Set the build command to `npm install` and the start command to `npm start`. The start script runs `node backend/server.js` without nodemon. In the service's Environment settings, set `MONGO_URI` to a reachable MongoDB connection string; do not rely on the local `backend/.env` file being available on Render. Render supplies `PORT` automatically.

The service only starts listening after MongoDB connects. Make sure the MongoDB provider allows connections from Render. If deployment still fails, check the Render service logs for the first build or runtime error.

## Docker Compose

Docker Compose is not configured in this repository yet; it has no `compose.yaml` or backend `Dockerfile`. Therefore, `docker compose up` will not start the app until those files are added. For now, use the local install and run commands above.

## API routes

- `/api/register` — account registration
- `/api/auth` — login and account profile
- `/api/users` — user accounts
- `/api/products` — products
- `/api/reviews` — product reviews
- `/api/orders` — orders
- `/api/deliveries` — delivery records
- `/api/payments` — payment records

Protected routes require a valid session token.

## Delete behavior

Account, product, and review delete actions permanently remove their matching MongoDB documents. Delivery and payment delete routes also remove their matching documents. Records that were soft-deleted before this behavior was added are not automatically purged.

