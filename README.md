# Bayanihan Connect
### Community Help Request System
> A digital platform inspired by the Filipino concept of *bayanihan* — helping one another.

---

## Project Structure

```
bayanihan-connect/
├── backend/
│   ├── config/
│   │   └── db.js                  # MySQL connection pool
│   ├── middleware/
│   │   ├── auth.js                # JWT middleware
│   │   └── upload.js              # Multer file upload
│   ├── routes/
│   │   ├── auth.js                # Register, login, profile
│   │   ├── requests.js            # Help request CRUD
│   │   ├── offers.js              # Help offer system
│   │   ├── messages.js            # Chat/messaging
│   │   ├── users.js               # Leaderboard, badges, notifications
│   │   ├── admin.js               # Admin moderation
│   │   └── categories.js          # Category list
│   ├── scripts/
│   │   └── seed.js                # Admin account seeder
│   ├── uploads/                   # User-uploaded images (auto-created)
│   ├── .env.example
│   ├── package.json
│   └── server.js                  # Express entry point
│
├── database/
│   └── schema.sql                 # MySQL schema (all tables)
│
└── frontend/
    ├── css/
    │   └── style.css              # Full design system
    ├── js/
    │   └── api.js                 # API client + Auth + UI helpers
    ├── index.html                 # Landing page
    ├── login.html                 # Login + Register
    ├── register.html              # Redirects to login?tab=register
    ├── dashboard.html             # User dashboard
    ├── profile.html               # Profile edit + badges
    ├── requests.html              # Browse & filter requests
    ├── request-detail.html        # Request detail + offers + chat
    ├── create-request.html        # Post / edit request form
    ├── edit-request.html          # Alias redirector
    ├── leaderboard.html           # Top helpers + badges
    └── admin.html                 # Admin panel
```

---

## Prerequisites

| Tool      | Version     |
|-----------|-------------|
| Node.js   | 18+         |
| MySQL     | 8.0+        |
| npm       | 9+          |

---

## Setup Instructions

### Step 1 — Database

```bash
# Log into MySQL
mysql -u root -p

# Run the schema
source /path/to/bayanihan-connect/database/schema.sql
# or:
mysql -u root -p < database/schema.sql
```

### Step 2 — Backend

```bash
cd backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
```

Edit `.env`:
```
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_actual_mysql_password
DB_NAME=bayanihan_connect
JWT_SECRET=any_long_random_string_here
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

### Step 3 — Seed Admin Account

```bash
# From backend/ directory
node scripts/seed.js
```

This creates:
- **Email:** `admin@bayanihan.com`
- **Password:** `Admin@123`

### Step 4 — Start the Backend

```bash
# Development (auto-restart)
npm run dev

# Production
npm start
```

Backend runs at: **http://localhost:5000**

### Step 5 — Serve the Frontend

The frontend is pure HTML/CSS/JS — no build step needed.

**Option A: VS Code Live Server**
- Install the "Live Server" extension
- Right-click `frontend/index.html` → Open with Live Server
- Runs at: http://localhost:5500

**Option B: Python HTTP Server**
```bash
cd frontend
python -m http.server 3000
# Visit: http://localhost:3000
```

**Option C: Node http-server**
```bash
npx http-server frontend -p 3000
# Visit: http://localhost:3000
```

---

## Default Accounts

| Role    | Email                     | Password   |
|---------|---------------------------|------------|
| Admin   | admin@bayanihan.com       | Admin@123  |
| *(Register your own user accounts via the UI)* | | |

---

## API Endpoints Reference

### Authentication
| Method | Endpoint                  | Auth | Description           |
|--------|---------------------------|------|-----------------------|
| POST   | `/api/auth/register`      | No   | Register new user     |
| POST   | `/api/auth/login`         | No   | Login                 |
| GET    | `/api/auth/me`            | Yes  | Current user profile  |
| PUT    | `/api/auth/profile`       | Yes  | Update profile        |
| PUT    | `/api/auth/password`      | Yes  | Change password       |

### Requests
| Method | Endpoint                      | Auth | Description              |
|--------|-------------------------------|------|--------------------------|
| GET    | `/api/requests`               | No   | Browse (filter/paginate) |
| POST   | `/api/requests`               | Yes  | Create request           |
| GET    | `/api/requests/:id`           | No   | Get single request       |
| PUT    | `/api/requests/:id`           | Yes  | Update request           |
| DELETE | `/api/requests/:id`           | Yes  | Delete request           |
| GET    | `/api/requests/user/mine`     | Yes  | My requests              |

### Offers
| Method | Endpoint                          | Auth | Description            |
|--------|-----------------------------------|------|------------------------|
| POST   | `/api/offers`                     | Yes  | Submit offer           |
| GET    | `/api/offers/request/:id`         | Yes  | Offers for a request   |
| PUT    | `/api/offers/:id/status`          | Yes  | Accept/reject offer    |
| GET    | `/api/offers/mine`                | Yes  | My offers (helper)     |

### Messages
| Method | Endpoint                  | Auth | Description       |
|--------|---------------------------|------|-------------------|
| GET    | `/api/messages/:req_id`   | Yes  | Get messages      |
| POST   | `/api/messages`           | Yes  | Send message      |

### Users
| Method | Endpoint                            | Auth | Description          |
|--------|-------------------------------------|------|----------------------|
| GET    | `/api/users/leaderboard`            | No   | Top helpers          |
| GET    | `/api/users/badges`                 | No   | All badges           |
| GET    | `/api/users/:id/badges`             | No   | User's badges        |
| GET    | `/api/users/notifications/list`     | Yes  | Notifications        |
| PUT    | `/api/users/notifications/read`     | Yes  | Mark all read        |
| POST   | `/api/users/rate`                   | Yes  | Rate a helper        |

### Admin (Admin role only)
| Method | Endpoint                        | Auth  |
|--------|---------------------------------|-------|
| GET    | `/api/admin/stats`              | Admin |
| GET    | `/api/admin/users`              | Admin |
| PUT    | `/api/admin/users/:id/toggle`   | Admin |
| GET    | `/api/admin/requests`           | Admin |
| DELETE | `/api/admin/requests/:id`       | Admin |
| PUT    | `/api/admin/requests/:id/status`| Admin |
| POST   | `/api/admin/broadcast`          | Admin |

---

## Features Checklist

- [x] User Authentication (JWT, register/login/logout)
- [x] Role selection: Requester, Helper, Both, Admin
- [x] Profile photos (upload + default avatar)
- [x] Help Request CRUD (title, description, category, location, urgency, image)
- [x] Help Offer System (submit, accept, reject)
- [x] Request Status Tracking (pending → in_progress → resolved/cancelled)
- [x] Messaging System (chat per request)
- [x] Location-based filtering
- [x] User Dashboard (requests, offers, stats)
- [x] Badge & Points System (auto-awarded on resolve)
- [x] Leaderboard (top helpers ranked)
- [x] Admin Dashboard (user/request moderation, broadcast)
- [x] Notifications (offer, message, badge, status, broadcast)
- [x] Helper Rating System (1–5 stars with comment)
- [x] Image upload for requests and profiles
- [x] Rate limiting (API protection)
- [x] Responsive UI (mobile-friendly)
- [x] Search & filtering (category, urgency, location, status, keyword)

---

## Tech Stack

| Layer     | Technology                    |
|-----------|-------------------------------|
| Frontend  | HTML5, CSS3, Vanilla JS       |
| Backend   | Node.js + Express             |
| Database  | MySQL 8                       |
| Auth      | JWT (jsonwebtoken)            |
| Passwords | bcryptjs (salt rounds: 10)    |
| Uploads   | Multer (local disk)           |
| Security  | express-rate-limit, CORS      |

---

## Troubleshooting

**"Cannot connect to MySQL"**
- Verify `DB_PASSWORD` in `.env` matches your MySQL root password
- Ensure MySQL service is running: `sudo systemctl start mysql`

**"CORS error" in browser**
- Confirm `FRONTEND_URL` in `.env` matches the URL you're serving the frontend from
- Default covers `localhost:3000` and `localhost:5500`

**"Token invalid" after restart**
- JWT_SECRET changed → users must log in again

**Image uploads not showing**
- Ensure `backend/uploads/` directory exists (auto-created on first upload)
- Check that the server is running on port 5000

---

*Built with the Filipino Bayanihan spirit — Tulong tayo sa isa't isa.*
