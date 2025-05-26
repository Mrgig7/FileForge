# Emergency CORS Fix Deployment Guide

## The Problem
Your file upload is being blocked by CORS policy because the backend deployment doesn't have the updated CORS configuration.

## Immediate Solution

### Step 1: Verify Environment Variables in Vercel
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your backend project (`fileforge-backend`)
3. Go to **Settings** → **Environment Variables**
4. Ensure you have:
   ```
   ALLOWED_CLIENTS=https://fileforge-indol.vercel.app
   MONGO_CONNECTION_URL=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret
   APP_BASE_URL=https://fileforge-backend.vercel.app
   ```

### Step 2: Force Redeploy Backend
1. In your Vercel backend project dashboard
2. Go to **Deployments** tab
3. Click the **three dots** on the latest deployment
4. Click **Redeploy**
5. Wait for deployment to complete

### Step 3: Test CORS Fix
After redeployment, test in browser console:
```javascript
// Test CORS from your frontend
fetch('https://fileforge-backend.vercel.app/api/test-cors', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('token')
    },
    body: JSON.stringify({test: 'cors'})
})
.then(response => {
    console.log('CORS Status:', response.status);
    console.log('CORS Headers:', Object.fromEntries([...response.headers]));
    return response.json();
})
.then(data => console.log('CORS Test Result:', data))
.catch(error => console.error('CORS Test Error:', error));
```

### Step 4: Test File Upload
1. Login to your app
2. Go to dashboard
3. Try uploading "Abhishikth's CA5.pdf"
4. Check browser console for success

## Alternative: Manual CORS Headers (If Above Doesn't Work)

If the deployment still has issues, add this to the very top of `server.js`:

```javascript
// EMERGENCY CORS FIX - Add this at the very top after require statements
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'https://fileforge-indol.vercel.app');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});
```

## Expected Results
- ✅ No CORS errors in browser console
- ✅ File upload succeeds
- ✅ Console shows: "Universal CORS headers set for origin: https://fileforge-indol.vercel.app"
- ✅ Upload returns file data with UUID

## Troubleshooting
If still not working:
1. Check Vercel function logs for errors
2. Verify environment variables are set correctly
3. Try the manual CORS fix above
4. Contact for further assistance

## Quick Test Commands
```bash
# Test if backend is responding
curl -X GET https://fileforge-backend.vercel.app/api/test

# Test CORS headers
curl -X OPTIONS https://fileforge-backend.vercel.app/api/files \
  -H "Origin: https://fileforge-indol.vercel.app" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type, Authorization" \
  -v
```
