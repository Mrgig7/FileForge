# FileForge Frontend Deployment Guide

This guide explains how to deploy the FileForge frontend on Vercel.

## Prerequisites

1. [Vercel](https://vercel.com) account
2. [GitHub](https://github.com) account 

## Step 1: Prepare Your Repository

1. Create a new GitHub repository for your frontend code
2. Push your frontend code to the repository

## Step 2: Vercel Configuration

1. Ensure your repository includes the `vercel.json` file:
   ```json
   {
     "rewrites": [
       { "source": "/(.*)", "destination": "/index.html" }
     ],
     "headers": [
       {
         "source": "/(.*)",
         "headers": [
           { "key": "Access-Control-Allow-Credentials", "value": "true" },
           { "key": "Access-Control-Allow-Origin", "value": "${process.env.BACKEND_URL}" },
           { "key": "Access-Control-Allow-Methods", "value": "GET,OPTIONS,PATCH,DELETE,POST,PUT" },
           { "key": "Access-Control-Allow-Headers", "value": "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization" }
         ]
       }
     ],
     "env": {
       "VITE_API_URL": "${process.env.BACKEND_URL}"
     }
   }
   ```

2. Update your `vite.config.js` to use environment variables:
   ```javascript
   import { defineConfig } from 'vite';
   import react from '@vitejs/plugin-react';

   export default defineConfig({
     plugins: [react()],
     server: {
       proxy: {
         '/api': {
           target: 'http://localhost:3000',
           changeOrigin: true,
           secure: false,
         }
       }
     },
     build: {
       outDir: 'dist',
       sourcemap: true
     }
   });
   ```

## Step 3: Deploy to Vercel

1. Log in to [Vercel](https://vercel.com)

2. Import your GitHub repository:
   - Click "Add New..." → "Project"
   - Select your GitHub repository
   - Vercel will automatically detect it as a Vite project

3. Configure project settings:
   - Framework Preset: `Vite`
   - Build Command: `npm run build` 
   - Output Directory: `dist`
   - Install Command: `npm install`

4. Add environment variables:
   - `VITE_API_URL`: Your backend URL (e.g., https://fileforge-api.vercel.app)
   - `BACKEND_URL`: Same as above, used for CORS headers in vercel.json

5. Click "Deploy"

## Step 4: Verify Deployment

1. Once deployment is complete, Vercel will provide you with a URL for your frontend
2. Visit the URL to check that your frontend is working
3. If you encounter issues:
   - Check the Vercel deployment logs
   - Verify that your environment variables are correct
   - Ensure your backend is accessible

## Step 5: Set Up Custom Domain (Optional)

1. In your Vercel project dashboard, go to "Settings" → "Domains"
2. Add your custom domain and follow the verification steps

## Continuous Deployment

Vercel automatically deploys changes when you push to your GitHub repository. For more control:

1. Go to your project in Vercel dashboard
2. Navigate to "Settings" → "Git"
3. Configure which branches should trigger deployments

## Troubleshooting

1. **API Connection Issues**:
   - Check that `VITE_API_URL` points to your backend
   - Verify CORS is configured correctly on the backend
   - Check browser console for network errors

2. **Build Failures**:
   - Review build logs in Vercel
   - Test the build locally with `npm run build`

3. **Environment Variables**:
   - Environment variables must be re-added if you create a new deployment
   - Use the Vercel CLI for more control over environment variables 