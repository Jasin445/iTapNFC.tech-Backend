# iTapNFC — Backend API

Node.js + Express + Prisma + PostgreSQL backend for iTapNFC. This powers everything
the frontend prototypes (landing page, auth screens, dashboard, product builder,
admin panel) need: authentication, NFC product CRUD, tap logging/analytics,
subscriptions, and admin management.

## Tech Stack

- Node.js + Express.js
- PostgreSQL + Prisma ORM
- JWT authentication + bcrypt password hashing
- Cloudinary for logo/image uploads
- express-validator / express-rate-limit for input safety on auth routes

## 1. Setup

```bash
npm install
cp .env.example .env
```

Edit `.env`:

```
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/itapnfc?schema=public"
JWT_SECRET="generate a long random string"
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

## 2. Database

```bash
npm run migrate     # creates tables from prisma/schema.prisma
npm run seed         # seeds plans, templates, an admin user, and a demo business
```

Seeded logins:

| Role  | Email                     | Password   |
|-------|---------------------------|------------|
| Admin | admin@itapnfc.tech          | Admin@123  |
| Demo  | grace@gracebistro.com     | Demo@123   |

## 3. Run

```bash
npm run dev    # nodemon, http://localhost:5000
```

`GET /health` should return `{ "status": "ok" }`.

## API Reference

All authenticated routes expect `Authorization: Bearer <token>`.

### Auth — `/api/auth`
| Method | Route              | Auth | Description |
|--------|--------------------|------|-------------|
| POST   | /register          | No   | Create account, returns JWT |
| POST   | /login             | No   | Returns JWT |
| GET    | /me                | Yes  | Current user |
| POST   | /forgot-password   | No   | Issues a reset token (emailed in production) |
| POST   | /reset-password    | No   | Consumes token, sets new password |

### Products — `/api/products` (all authenticated)
| Method | Route             | Description |
|--------|-------------------|-------------|
| POST   | /                 | Create a product (`type`, `name`, `fields`, `themeColor`) |
| GET    | /                 | List my products |
| GET    | /:id              | Get one product |
| PUT    | /:id              | Update name/fields/status/themeColor |
| DELETE | /:id              | Delete a product |
| POST   | /:id/logo         | multipart upload → Cloudinary, sets `logoUrl` |
| GET    | /:id/analytics    | Per-product taps + device breakdown |

`type` is one of: `PAYMENT, MENU, DONATION, REVIEW, CARD, ATTENDANCE, VISITOR, ASSET`.

### Public — `/api/p` (no auth — this is what the NFC card actually opens)
| Method | Route         | Description |
|--------|---------------|-------------|
| GET    | /:slug        | Public page data for a live product |
| POST   | /:slug/tap    | Logs a tap (device parsed from User-Agent) |

### Dashboard — `/api/dashboard` (authenticated)
| Method | Route     | Description |
|--------|-----------|-------------|
| GET    | /summary  | Totals, today's taps, device usage, top products, daily/monthly series |

### Billing — `/api/billing` (authenticated)
| Method | Route                  | Description |
|--------|------------------------|-------------|
| GET    | /plans                 | All plans |
| GET    | /subscription          | My subscription |
| PUT    | /subscription/plan     | Change plan tier |
| DELETE | /subscription          | Cancel |

### Admin — `/api/admin` (authenticated + `role: ADMIN`)
| Method | Route                      | Description |
|--------|----------------------------|-------------|
| GET    | /users                     | List users (`?search=&plan=`) |
| PATCH  | /users/:id/status          | Suspend / reactivate |
| GET    | /products                  | List all products platform-wide |
| PATCH  | /products/:id/status       | Disable / re-enable |
| GET    | /templates                 | List builder templates |
| POST   | /templates                | Create template |
| PUT    | /templates/:id            | Update template |
| DELETE | /templates/:id            | Delete template |
| GET    | /subscriptions             | List all subscriptions |
| PATCH  | /subscriptions/:id         | Update status |
| GET    | /analytics                  | Platform totals, MRR, plan mix, monthly taps |
| GET    | /export/:type              | CSV download — type = `users`, `products`, `subscriptions` |

## Project Structure

```
src/
  app.js                Express app + middleware + route mounting
  server.js              Entry point
  config/                Prisma client, Cloudinary config
  middleware/             auth, requireAdmin, upload, errorHandler
  utils/                  jwt, slugify, csv, device, asyncHandler
  controllers/            auth, product, tap, billing, admin
  routes/                 auth, product, public, dashboard, billing, admin
prisma/
  schema.prisma           Data model
  seed.js                 Seed script
```

## Notes / Next Steps

- **Domain**: the frontend is built for `https://itapnfc.tech`. `CLIENT_URL` in
  `.env` is already set to that for CORS. When you deploy this API, the common
  pattern is to host it at a subdomain — e.g. `api.itapnfc.tech` — and point
  the frontend's `fetch()` calls there.
- Email delivery for password resets isn't wired to a provider — `forgotPassword`
  returns the raw token directly in non-production responses so the flow is
  testable; plug in SES/Postmark/Resend before shipping.
- Tap → device detection is a simple User-Agent string check; swap in a proper
  parser (e.g. `ua-parser-js`) if you need OS/browser versions too.
- Rate limiting is only applied to `/api/auth/*`. Consider adding it to the
  public `/api/p/:slug/tap` endpoint too, to guard against tap-spam.
- This API is CORS-restricted to `CLIENT_URL` — already set to `itapnfc.tech`
  above; update it if you deploy the frontend somewhere else first (e.g. a
  Vercel preview URL) before the domain is live.
