# Securing Your Vercel Deployment

## Security Issue Found

We noticed that sensitive credentials were directly included in the `vercel.json` file. This poses a significant security risk as it exposes your database credentials and other sensitive information to anyone who can access your repository.

## How to Properly Configure Environment Variables in Vercel

1. **Remove Sensitive Data from vercel.json**
   - We've updated the `vercel.json` file to use environment variable placeholders instead of hardcoded values.

2. **Create a Local .env File (For Development Only)**
   - Create a `.env` file in your backend directory with the following variables:
   ```
   # Server Configuration
   PORT=3000
   NODE_ENV=development

   # MongoDB Connection
   MONGO_CONNECTION_URL=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority

   # Session and Authentication
   SESSION_SECRET=your_session_secret_key
   JWT_SECRET=your_jwt_secret_key

   # App URLs
   APP_BASE_URL=http://localhost:3000
   ALLOWED_CLIENTS=http://localhost:5173,https://fileforge-react.vercel.app

   # Cloudinary Configuration
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   CLOUDINARY_URL=cloudinary://your_api_key:your_api_secret@your_cloud_name

   # Email Configuration
   SMTP_HOST=smtp.example.com
   SMTP_PORT=587
   MAIL_USER=your_email@example.com
   MAIL_PASS=your_email_password
   ```

3. **Set Environment Variables in Vercel Dashboard**

   a. Go to your Vercel dashboard and select your project.
   
   b. Navigate to the "Settings" tab.
   
   c. Scroll down to the "Environment Variables" section.
   
   d. Add each environment variable with its corresponding value:
      - MONGO_CONNECTION_URL
      - JWT_SECRET
      - APP_BASE_URL (set to your Vercel deployment URL: https://fileforge-backend.vercel.app)
      - ALLOWED_CLIENTS (include your frontend URL: https://fileforge-react.vercel.app)
      - CLOUDINARY_CLOUD_NAME
      - CLOUDINARY_API_KEY
      - CLOUDINARY_API_SECRET
      - CLOUDINARY_URL
      - SMTP_HOST
      - SMTP_PORT
      - MAIL_USER
      - MAIL_PASS

4. **Redeploy Your Application**
   - After setting all the environment variables, trigger a new deployment.

## CORS Configuration

Your backend currently has CORS configured to allow requests from specific origins including:
- http://127.0.0.1:5173
- http://localhost:5173
- http://localhost:3000
- https://fileforge-react.vercel.app
- https://file-forge-react.vercel.app

Make sure your frontend URL is included in the `ALLOWED_CLIENTS` environment variable in Vercel.

## Fixing MongoDB Connection Error

You're currently seeing the following error:
```
MongoParseError: Invalid scheme, expected connection string to start with "mongodb://" or "mongodb+srv://"
```

This happens because the MongoDB connection string isn't properly set in Vercel. To fix this:

1. **Ensure the MONGO_CONNECTION_URL environment variable is set correctly in Vercel:**
   - The value should start with `mongodb+srv://` or `mongodb://`
   - Example format: `mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority`
   
2. **Common issues and solutions:**
   - Make sure there are no extra quotes (") or spaces in your environment variable
   - Vercel's environment variable UI can sometimes add extra characters if you copy/paste - check carefully
   - Ensure the variable name is exactly `MONGO_CONNECTION_URL` (case-sensitive)
   - If your MongoDB password contains special characters, ensure they're properly URL-encoded

3. **Debugging steps:**
   - Set a temporary environment variable with a simple value to test (e.g., `TEST_VAR=hello`)
   - Add a console.log in your code to output both variables: 
     ```js
     console.log("Test var:", process.env.TEST_VAR);
     console.log("MongoDB URL starts with:", process.env.MONGO_CONNECTION_URL ? process.env.MONGO_CONNECTION_URL.substring(0, 20) : "undefined");
     ```
   - Add this code to your `db.js` file to verify what's happening:
     ```js
     console.log("MongoDB URL is set:", !!process.env.MONGO_CONNECTION_URL);
     console.log("MongoDB URL type:", typeof process.env.MONGO_CONNECTION_URL);
     console.log("MongoDB URL starts with:", process.env.MONGO_CONNECTION_URL ? process.env.MONGO_CONNECTION_URL.substring(0, 20) : "undefined");
     ```

4. **Alternative solution if all else fails:**
   - Temporarily add a fallback URL in your code as a safety measure while debugging:
     ```js
     mongoose.connect(process.env.MONGO_CONNECTION_URL || "mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority");
     ```

## Important Security Reminders

1. **Never commit sensitive credentials to your repository**
2. **Add .env to your .gitignore file**
3. **Regularly rotate your API keys and passwords**
4. **Consider using a secret manager for production environments**

## Checking Your Deployment

After deploying with proper environment variables, you can verify your deployment is working by:

1. Visit https://fileforge-backend.vercel.app
2. Test API endpoints like https://fileforge-backend.vercel.app/api/test-auth (POST request)
3. Verify your frontend can successfully connect to the backend 