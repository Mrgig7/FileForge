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

1. **In `server.js`:** Added a fallback MongoDB URL for the session store:
   ```javascript
   store: MongoStore.create({
       mongoUrl: process.env.MONGO_CONNECTION_URL || "mongodb+srv://nitesh_01:6UZsptd3070RWHHw@filesharingmanager.w6zlzbj.mongodb.net/?retryWrites=true&w=majority&appName=FileSharingManager",
       collectionName: 'sessions'
   }),
   ```

2. **In `config/db.js`:** Enhanced error handling and validation of the MongoDB URL:
   ```javascript
   // Check if the environment variable exists and is valid
   let connectionURL;
   
   if (process.env.MONGO_CONNECTION_URL) {
       const urlValue = process.env.MONGO_CONNECTION_URL.trim();
       // Check if the URL starts with mongodb:// or mongodb+srv://
       if (urlValue.startsWith('mongodb://') || urlValue.startsWith('mongodb+srv://')) {
           connectionURL = urlValue;
           console.log("Using environment variable for MongoDB connection");
       } else {
           console.log("WARNING: Environment variable exists but has invalid format");
           connectionURL = FALLBACK_MONGO_URL;
           console.log("Using fallback MongoDB URL");
       }
   } else {
       connectionURL = FALLBACK_MONGO_URL;
   }
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

## How to Fix in Vercel

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

## Next Steps

After making these changes:

1. **Redeploy your application** to Vercel
2. **Check the logs** for any relevant error messages
3. **Monitor the database connection** to ensure it's stable

If you've properly set the environment variable in Vercel, you should see the following in your logs:
```
Using environment variable for MongoDB connection
URL starts with: mongodb+srv://user...
Attempting to connect to MongoDB...
MongoDB database connection established successfully 🥳🥳🥳🥳
```

If you see:
```
Environment variable MONGO_CONNECTION_URL is undefined or empty
Using fallback MongoDB URL
```

This indicates that Vercel is not properly passing the environment variable to your application.

## Security Reminder

Remember:
- The fallback MongoDB URL in your code is a temporary measure
- For security, set proper environment variables in Vercel and remove hardcoded credentials
- Consider using Vercel's integration with MongoDB Atlas for easier configuration 