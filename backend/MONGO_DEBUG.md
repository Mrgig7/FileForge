# MongoDB Connection Debugging Guide for Vercel Deployment

## Current Issue

You're encountering a MongoDB connection issue in your Vercel deployment:
```
MongoParseError: Invalid scheme, expected connection string to start with "mongodb://" or "mongodb+srv://"
```

This error occurs in two places:
1. When initializing the database connection in `db.js`
2. When initializing the session store using `connect-mongo` in `server.js`

## Fixed Implementation

We've made the following changes to fix this issue:

1. **Removed hardcoded fallback URLs**: We removed all hardcoded MongoDB connection strings from the codebase to rely only on environment variables:
   ```javascript
   // In db.js
   if (!process.env.MONGO_CONNECTION_URL) {
     throw new Error("MONGO_CONNECTION_URL environment variable is not defined");
   }
   ```

2. **In `server.js`:** Using only environment variables for the session store:
   ```javascript
   store: MongoStore.create({
       mongoUrl: process.env.MONGO_CONNECTION_URL,
       collectionName: 'sessions'
   }),
   ```

3. **Removed Environment Variables from vercel.json:**
   We identified that the root cause was Vercel not properly processing environment variables in the `vercel.json` file. The `${VARIABLE_NAME}` syntax was being passed literally to the application instead of being substituted with actual values.
   
   ```diff
   - "env": {
   -   "NODE_ENV": "production",
   -   "MONGO_CONNECTION_URL": "${MONGO_CONNECTION_URL}",
   -   "JWT_SECRET": "${JWT_SECRET}",
   -   ...
   - }
   ```
   
   Vercel doesn't support variable interpolation in the `vercel.json` file. Instead, environment variables should be set directly in the Vercel dashboard.

## Environment Variable Issues in Vercel

Common issues with environment variables in Vercel that might cause this problem:

1. **Incorrect Format:** 
   - The environment variable might have extra quotes, spaces, or line breaks
   - It might be missing the required prefix (`mongodb://` or `mongodb+srv://`)

2. **Encoding Issues:**
   - Special characters in passwords might need URL encoding
   - Copying/pasting from certain applications can introduce invisible characters

3. **Variable Name Mismatch:**
   - Ensure the variable is named exactly `MONGO_CONNECTION_URL` (case-sensitive)

4. **Vercel.json Environment Variables:**
   - Do not use `${VARIABLE_NAME}` syntax in vercel.json
   - Set environment variables directly in the Vercel dashboard instead

## How to Set Environment Variables in Vercel

1. **Set Environment Variables in Vercel Dashboard:**
   - Go to your Vercel project dashboard
   - Navigate to Settings > Environment Variables
   - Add each environment variable directly with the proper values
   - Do not include quotes around the values
   - Make sure the MongoDB connection string starts with `mongodb://` or `mongodb+srv://`

2. **Formatting Your Connection String:**
   - Ensure it starts with `mongodb://` or `mongodb+srv://`
   - Make sure there are no quotes around the string
   - Remove any leading/trailing whitespace
   - Example format: `mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority`

3. **Testing Your Connection String:**
   - Before adding to Vercel, test your connection string locally
   - Use a simple Node.js script to verify the connection works

```javascript
const mongoose = require('mongoose');
const uri = "YOUR_CONNECTION_STRING_HERE";

async function testConnection() {
  try {
    await mongoose.connect(uri);
    console.log("Connection successful!");
    await mongoose.disconnect();
  } catch (error) {
    console.error("Connection failed:", error);
  }
}

testConnection();
```

## Required Environment Variables

Make sure all these environment variables are set in your Vercel project:

```
MONGO_CONNECTION_URL=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
ALLOWED_CLIENTS=https://your-frontend-url.vercel.app
APP_BASE_URL=https://your-backend-url.vercel.app
SMTP_HOST=smtp.example.net
SMTP_PORT=587
MAIL_USER=your_email@example.net
MAIL_PASS=your_password
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_URL=cloudinary://your_api_key:your_api_secret@your_cloud_name
JWT_SECRET=your_jwt_secret_key
```

## Next Steps

After making these changes:

1. **Redeploy your application** to Vercel
2. **Check the logs** for any relevant error messages
3. **Monitor the database connection** to ensure it's stable

If you've properly set the environment variables in Vercel, you should see the following in your logs:
```
Using environment variable for MongoDB connection
URL starts with: mongodb+srv://user...
Attempting to connect to MongoDB...
MongoDB database connection established successfully 🥳🥳🥳🥳
```

## Security Reminder

Remember:
- Never include sensitive credentials in your code
- Use environment variables for all sensitive information
- Regularly rotate your passwords and API keys
- Consider using Vercel's integration with MongoDB Atlas for easier configuration 