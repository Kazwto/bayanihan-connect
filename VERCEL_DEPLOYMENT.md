# Vercel Deployment Guide

## Prerequisites
1. GitHub account with the repository pushed
2. Vercel account (create at vercel.com)
3. Database hosting (PlanetScale, Supabase MySQL, or AWS RDS)

## Option 1: Recommended - Separate Deployments

### Step 1: Prepare Frontend for Vercel

1. Create `frontend/.vercelignore`:
```
.env
.env.local
node_modules
```

2. Update frontend API calls in `js/api.js` to use the backend URL from environment:
```javascript
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
```

### Step 2: Deploy Frontend

1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import your GitHub repository
4. Select `frontend` as root directory
5. Set build command: `npm install` (if needed)
6. Deploy

### Step 3: Prepare Backend for Vercel

1. Update `backend/server.js` to handle Vercel's serverless environment:
   - Change connection pooling for serverless
   - Export handler for serverless functions

2. Create `api/index.js` (Vercel entry point):
```javascript
module.exports = require('../backend/server.js');
```

### Step 4: Deploy Backend

1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import your GitHub repository
4. Select root directory: `.`
5. Set environment variables:
   - `DB_HOST`: Your MySQL host
   - `DB_USER`: Database user
   - `DB_PASSWORD`: Database password
   - `DB_NAME`: bayanihan_connect
   - `JWT_SECRET`: Your secret
   - `FRONTEND_URL`: Your frontend Vercel URL
   - `NODE_ENV`: production
6. Deploy

### Step 5: Update Frontend with Backend URL

After backend deploys:
1. Go to frontend project settings
2. Add environment variable: `REACT_APP_API_URL=https://your-backend.vercel.app`
3. Redeploy frontend

## Database Setup

### Using PlanetScale (Recommended)
1. Create account at [planetscale.com](https://planetscale.com)
2. Create new database
3. Connect from anywhere
4. Create branch and push schema
5. Use connection string in environment variables

### Using AWS RDS
1. Create RDS MySQL instance
2. Allow Vercel IPs in security group
3. Import schema
4. Use connection details in environment variables

## Important Notes

- Vercel serverless functions have a 60-second timeout (configurable to 900s)
- MySQL connections may need connection pooling optimization for serverless
- File uploads (via Multer) should use cloud storage like AWS S3 or Vercel Blob
- Environment variables are set in Vercel project settings, not in .env

## Troubleshooting

- **CORS errors**: Update `FRONTEND_URL` in backend environment
- **Database connection timeout**: Check firewall/security groups allow Vercel IPs
- **Build failures**: Ensure all dependencies are in package.json
