# FileForge Backend Deployment Guide

This guide explains how to deploy the FileForge backend API on Vercel.

## Prerequisites

1. [Vercel](https://vercel.com) account
2. [GitHub](https://github.com) account
3. [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) account for database
4. [Cloudinary](https://cloudinary.com) account for image storage

## Step 1: Prepare Your Repository

1. Create a new GitHub repository for your backend code
2. Push your backend code to the repository

## Step 2: Vercel Configuration

1. Ensure your repository includes the `vercel.json` file:
   ```json
   {
     "version": 2,
     "builds": [
       {
         "src": "server.js",
         "use": "@vercel/node"
       }
     ],
     "routes": [
       {
         "src": "/api/(.*)",
         "dest": "server.js"
       },
       {
         "src": "/files/(.*)",
         "dest": "server.js"
       },
       {
         "src": "/uploads/(.*)",
         "dest": "server.js"
       },
       {
         "src": "/(.*)",
         "dest": "server.js"
       }
     ]
   }
   ```

2. Ensure your CORS configuration in `server.js` includes your frontend domain:
   ```javascript
   const corsOptions = {
     origin: function(origin, callback) {
       const allowedOrigins = [
         'http://127.0.0.1:5173', 
         'http://localhost:5173', 
         'http://localhost:3000',
         'https://fileforge-react.vercel.app',
         'https://your-frontend-domain.vercel.app'
       ];
       
       // Add origins from env variables
       if (process.env.ALLOWED_CLIENTS) {
         const envOrigins = process.env.ALLOWED_CLIENTS.split(',');
         envOrigins.forEach(origin => {
           allowedOrigins.push(origin.trim().replace(/\/$/, ''));
         });
       }
       
       if (!origin || allowedOrigins.indexOf(origin) !== -1) {
         callback(null, true);
       } else {
         console.log('CORS blocked origin:', origin);
         callback(new Error('Not allowed by CORS'));
       }
     },
     credentials: true,
     // other CORS options...
   }
   ```

## Step 3: Set Up MongoDB Atlas

1. Create a cluster in MongoDB Atlas if you don't have one
2. Create a database user with appropriate permissions
3. Configure network access to allow connections from any IP (for Vercel) or specific IPs
4. Get your connection string in the format:
   ```
   mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority
   ```

## Step 4: Set Up Cloudinary

1. Create a Cloudinary account or use your existing one
2. Note your Cloudinary credentials:
   - Cloud Name
   - API Key
   - API Secret

## Step 5: Deploy to Vercel

1. Log in to [Vercel](https://vercel.com)

2. Import your GitHub repository:
   - Click "Add New..." → "Project"
   - Select your GitHub repository
   - Vercel should detect it as a Node.js project

3. Configure project settings:
   - Framework Preset: `Node.js`
   - Build Command: `npm install`
   - Output Directory: `.`
   - Install Command: `npm install`

4. Add environment variables:
   - `MONGO_CONNECTION_URL`: Your MongoDB Atlas connection string
   - `JWT_SECRET`: A secure random string for JWT token generation
   - `APP_BASE_URL`: The URL of your backend (will be available after deployment)
   - `ALLOWED_CLIENTS`: Comma-separated list of frontend domains
   - `CLOUDINARY_CLOUD_NAME`: Your Cloudinary cloud name
   - `CLOUDINARY_API_KEY`: Your Cloudinary API key
   - `CLOUDINARY_API_SECRET`: Your Cloudinary API secret
   - `CLOUDINARY_URL`: Your full Cloudinary URL

5. Click "Deploy"

## Step 6: Update Environment Variables Post-Deployment

After deployment, you'll get a domain like `fileforge-api.vercel.app`. You need to:

1. Go back to your project settings in Vercel
2. Update the `APP_BASE_URL` environment variable with your new backend URL
3. Click "Save" and redeploy if necessary

## Step 7: Test Your API

1. Test a basic endpoint like `/api/test` using a tool like Postman or your browser
2. Check the Vercel logs if you encounter any issues

## Step 8: Connect Frontend

1. Configure your frontend to use your new backend URL
2. Update the `ALLOWED_CLIENTS` environment variable to include your frontend domain

## File Storage Considerations

Vercel has an ephemeral filesystem, meaning files uploaded to the server won't persist. You should:

1. Use Cloudinary for image storage (already implemented for profile pictures)
2. For other file uploads:
   - Implement Cloudinary storage for all files
   - OR use another cloud storage service like AWS S3
   - OR use MongoDB GridFS for storing files in the database

## Continuous Deployment

Vercel automatically deploys changes when you push to your GitHub repository. For more control:

1. Go to your project in Vercel dashboard
2. Navigate to "Settings" → "Git"
3. Configure which branches should trigger deployments

## Troubleshooting

1. **Database Connection Issues**:
   - Verify your MongoDB connection string is correct
   - Check that your IP access list in MongoDB Atlas includes 0.0.0.0/0 or Vercel IPs
   - Check Vercel logs for connection errors

2. **CORS Issues**:
   - Make sure your frontend URL is included in CORS configuration
   - Update the `ALLOWED_CLIENTS` environment variable with your frontend domain

3. **File Upload Issues**:
   - Confirm Cloudinary credentials are correct
   - Implement server-side validation for file size and type

4. **JWT Authentication**:
   - Ensure `JWT_SECRET` is set correctly
   - Check for proper token handling in requests