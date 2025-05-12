# Deploying the Frontend to Vercel

This guide will help you deploy the frontend of FileForge to Vercel and connect it to your backend.

## Prerequisites

1. A GitHub repository with your frontend code
2. A Vercel account
3. Your backend already deployed at `https://fileforge-backend.vercel.app`

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

### 3. Set Up Environment Variables

In the Vercel project settings, you need to add the following environment variables:

| Name | Value |
|------|-------|
| `BACKEND_URL` | `https://fileforge-backend.vercel.app` |
| `VITE_API_URL` | `https://fileforge-backend.vercel.app/api` |

To add these:
1. Go to your project in the Vercel dashboard
2. Navigate to "Settings" > "Environment Variables"
3. Add each variable name and value
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