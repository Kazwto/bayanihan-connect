# Vercel Deployment Quick Start

## Overview
This guide will help you deploy Bayanihan Connect to Vercel. The project will be deployed as a single monorepo with:
- **Frontend**: Static HTML/CSS/JS served from Vercel
- **Backend API**: Serverless functions on Vercel
- **Database**: Hosted externally (PlanetScale, Supabase, or AWS RDS)

---

## Step 1: Set Up Database Hosting

### Option A: PlanetScale (Recommended - Free Tier Available)

1. Create account at https://planetscale.com
2. Create a new database named `bayanihan_connect`
3. Go to **Branches** → **main** → **Connect**
4. Select "MySQL" and copy the connection string
5. Note these values:
   - `DB_HOST`: From connection string
   - `DB_USER`: From connection string (default: root)
   - `DB_PASSWORD`: From connection string

### Option B: Supabase MySQL

1. Create account at https://supabase.com
2. Create a new project with MySQL
3. Go to **Settings** → **Database** and copy connection details

### Option C: AWS RDS

1. Create MySQL instance in AWS RDS
2. Allow Vercel IPs: `0.0.0.0/0` (or specific Vercel IP ranges)
3. Import the schema from `database/schema.sql`

---

## Step 2: Push Code to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/bayanihan-connect.git
git push -u origin main
```

---

## Step 3: Deploy on Vercel

### 3.1 Frontend Deployment

1. Go to https://vercel.com and sign in with GitHub
2. Click **Add New** → **Project**
3. Select your `bayanihan-connect` repository
4. Configure project:
   - **Framework**: None (Static)
   - **Root Directory**: `frontend`
   - **Build Command**: Leave empty (no build needed)
   - **Output Directory**: `frontend`
5. Click **Deploy**
6. Note the deployed URL (e.g., `https://bayanihan-connect-frontend.vercel.app`)

### 3.2 Backend Deployment

1. Create a **new** Vercel project for the backend
2. Click **Add New** → **Project**
3. Select the same repository
4. Configure project:
   - **Root Directory**: Leave default (`.`)
   - **Framework**: Node.js
   - **Build Command**: `npm install --prefix backend`
5. **Add Environment Variables** (click "Environment Variables"):

| Variable | Value |
|----------|-------|
| `DB_HOST` | Your database host |
| `DB_USER` | Database user |
| `DB_PASSWORD` | Database password |
| `DB_NAME` | `bayanihan_connect` |
| `JWT_SECRET` | Generate a random string (e.g., `your-secret-key-here`) |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | Your frontend Vercel URL (from Step 3.1) |
| `PORT` | `3000` |

6. Click **Deploy**
7. Note the backend URL (e.g., `https://bayanihan-connect-api.vercel.app`)

---

## Step 4: Connect Frontend to Backend

1. Go to your **frontend** Vercel project
2. Go to **Settings** → **Environment Variables**
3. Add a new variable:
   - **Name**: `FRONTEND_CONFIG`
   - **Value**: Add this script to your frontend HTML:
   
   ```html
   <script>
     window.API_BASE_URL = 'https://your-backend-url.vercel.app/api';
   </script>
   ```
   
   Add this script **before** `<script src="js/api.js"></script>` in all HTML files

4. Or, add a **Vercel Environment Variable**:
   - Go to **Settings** → **Environment Variables**
   - Add `API_URL` = `https://your-backend-url.vercel.app`

---

## Step 5: Import Database Schema

1. Connect to your database using MySQL client:
   ```bash
   mysql -h DB_HOST -u DB_USER -p
   ```

2. Create and import the schema:
   ```sql
   CREATE DATABASE bayanihan_connect;
   USE bayanihan_connect;
   SOURCE database/schema.sql;
   ```

3. Verify tables were created:
   ```sql
   SHOW TABLES;
   ```

---

## Step 6: Create Admin Account

1. Update `backend/scripts/seed.js` with admin credentials
2. Run locally:
   ```bash
   cd backend
   npm install
   node scripts/seed.js
   ```

3. Or SSH into backend and run:
   ```bash
   npm run seed
   ```

---

## Step 7: Update HTML Files

Add this script to the `<head>` of each HTML file **before** `<script src="js/api.js"></script>`:

```html
<script>
  // Set API base URL for production
  window.API_BASE_URL = localStorage.getItem('api_base_url') || 'http://localhost:5000/api';
  // For production, set via query param or Vercel environment variable
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('api_url')) {
    window.API_BASE_URL = urlParams.get('api_url');
    localStorage.setItem('api_base_url', urlParams.get('api_url'));
  }
</script>
```

---

## Troubleshooting

### 🔴 CORS Errors
- Update `FRONTEND_URL` environment variable in backend
- Ensure backend CORS origins include frontend URL

### 🔴 Database Connection Timeout
- Verify database host is accessible from Vercel
- Check database firewall/security groups allow all IPs (`0.0.0.0/0`)
- Test connection locally first

### 🔴 404 on API Routes
- Verify `api/index.js` exists
- Check `vercel.json` rewrites are correct
- Ensure backend port is `3000` for Vercel (use `PORT` env var)

### 🔴 Static Files Not Loading
- Verify all static files are in `frontend/` directory
- Check `<link>` and `<script>` paths are relative

---

## Production Checklist

- [ ] Database is set up and accessible
- [ ] Environment variables are set in Vercel
- [ ] Frontend and backend are deployed
- [ ] API base URL is configured in frontend
- [ ] Admin account is created
- [ ] CORS is configured
- [ ] JWT_SECRET is set to a strong value
- [ ] Database schema is imported
- [ ] File uploads path is configured (if using Multer)

---

## Next Steps

- Add custom domain to Vercel
- Set up CI/CD for automatic deployments
- Monitor errors with Vercel Analytics
- Set up email notifications for deployments
