# Deploying the Frontend to Vercel

This guide will help you deploy the frontend of FileForge to Vercel and connect it to your backend.

## Prerequisites

1. A GitHub repository with your frontend code
2. A Vercel account
3. Your backend already deployed at `https://fileforge-backend.vercel.app`

## Development vs Production Environment

Your application uses different API URLs based on the environment:

- **Development (Local)**: `VITE_API_URL=http://localhost:3000/api`
- **Production (Vercel)**: `VITE_API_URL=https://fileforge-backend.vercel.app/api`

## Deployment Steps

### 1. Push Your Frontend Code to GitHub

Make sure your latest frontend code is pushed to GitHub.

### 2. Create a New Project in Vercel

1. Log in to your Vercel account
2. Click on "Add New..." > "Project"
3. Import your GitHub repository
4. Configure the project:
   - Framework Preset: Vite
   - Root Directory: `frontend` (if your repository has both frontend and backend)
   - Build Command: `npm run build`
   - Output Directory: `dist`

### 3. Set Up Environment Variables in Vercel

In the Vercel project settings, you need to add the following environment variables:

| Name | Value |
|------|-------|
| `VITE_API_URL` | `https://fileforge-backend.vercel.app/api` |

This is crucial because your local `.env` file only has `VITE_API_URL=http://localhost:3000/api`, which won't work in production.

To add these variables:
1. Go to your project in the Vercel dashboard
2. Navigate to "Settings" > "Environment Variables"
3. Add the variable name and value
4. Click "Save"

### 4. Deploy Your Project

1. Click on "Deploy"
2. Wait for the build to complete
3. Vercel will provide you with a deployment URL (e.g., `https://fileforge-react.vercel.app`)

### 5. Configure Custom Domain (Optional)

If you have a custom domain:
1. Go to your project in the Vercel dashboard
2. Navigate to "Settings" > "Domains"
3. Add your custom domain and follow the instructions

## Managing Environment Variables

### Option 1: Environment Files

You can create different environment files for different deployment environments:

- `.env` - Local development defaults
- `.env.development` - Development-specific variables
- `.env.production` - Production-specific variables

For example:
```
# .env.development
VITE_API_URL=http://localhost:3000/api

# .env.production
VITE_API_URL=https://fileforge-backend.vercel.app/api
```

Vite will automatically use the correct file based on the build mode.

### Option 2: Vercel Dashboard

Set environment variables directly in the Vercel dashboard as described above.

## Troubleshooting CORS Issues

If you encounter CORS issues:

1. Verify that your backend's CORS configuration includes your frontend domain:
   ```javascript
   const allowedOrigins = [
     'https://fileforge-react.vercel.app',
     // other origins...
   ];
   ```

2. Check that your frontend is using the correct API URL:
   ```javascript
   const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
   ```

3. Ensure the `vercel.json` in your frontend has the correct CORS headers:
   ```json
   {
     "headers": [
       {
         "source": "/(.*)",
         "headers": [
           { "key": "Access-Control-Allow-Credentials", "value": "true" },
           { "key": "Access-Control-Allow-Origin", "value": "https://fileforge-backend.vercel.app" },
           { "key": "Access-Control-Allow-Methods", "value": "GET,OPTIONS,PATCH,DELETE,POST,PUT" },
           { "key": "Access-Control-Allow-Headers", "value": "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization" }
         ]
       }
     ]
   }
   ```

## Next Steps

1. Test your application thoroughly
2. Set up monitoring for your application
3. Consider implementing CI/CD for automated deployments 