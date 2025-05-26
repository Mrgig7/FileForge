# CORS Fix Deployment and Testing Guide

## 🚨 IMMEDIATE ACTION REQUIRED

Your CORS fixes are in the code but not deployed. Follow these steps **in order**:

## Step 1: Verify Current Deployment Status

**Test this URL in your browser RIGHT NOW:**
```
https://fileforge-backend.vercel.app/api/deployment-info
```

**Expected Response (if fixes are deployed):**
```json
{
  "corsFixVersion": "2.0",
  "allowedClients": "https://fileforge-indol.vercel.app",
  "corsMiddlewareActive": true,
  "universalCorsActive": true
}
```

**If you get an error or different response, the deployment is NOT updated.**

## Step 2: Force Deploy the CORS Fixes

### Option A: Git Push (Recommended)
```bash
# In your backend directory
git add .
git commit -m "URGENT: Deploy CORS fixes for file upload"
git push origin main
```

### Option B: Manual Vercel Redeploy
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Find your `fileforge-backend` project
3. Click on it
4. Go to **Deployments** tab
5. Click the **3 dots** on the latest deployment
6. Click **Redeploy**
7. Wait 2-3 minutes for completion

## Step 3: Verify Environment Variables

**CRITICAL:** Check these in Vercel Dashboard → Settings → Environment Variables:

| Variable | Value | Status |
|----------|-------|--------|
| `ALLOWED_CLIENTS` | `https://fileforge-indol.vercel.app` | ❌ MUST SET |
| `MONGO_CONNECTION_URL` | `mongodb+srv://...` | ✅ Should exist |
| `JWT_SECRET` | `your-secret` | ✅ Should exist |
| `APP_BASE_URL` | `https://fileforge-backend.vercel.app` | ✅ Should exist |

**If `ALLOWED_CLIENTS` is missing, ADD IT NOW:**
1. Go to Settings → Environment Variables
2. Add new variable:
   - Name: `ALLOWED_CLIENTS`
   - Value: `https://fileforge-indol.vercel.app`
3. Click Save
4. Redeploy

## Step 4: Test CORS After Deployment

**Run this in browser console on https://fileforge-indol.vercel.app:**

```javascript
// Test 1: Check deployment version
fetch('https://fileforge-backend.vercel.app/api/deployment-info')
  .then(r => r.json())
  .then(data => {
    console.log('🔍 Deployment Info:', data);
    if (data.corsFixVersion === '2.0') {
      console.log('✅ CORS fixes are deployed!');
    } else {
      console.log('❌ CORS fixes NOT deployed yet');
    }
  });

// Test 2: Test CORS headers
fetch('https://fileforge-backend.vercel.app/api/test-cors', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({test: 'cors'})
})
.then(response => {
  console.log('🔍 CORS Status:', response.status);
  console.log('🔍 CORS Headers:', Object.fromEntries([...response.headers]));
  return response.json();
})
.then(data => console.log('✅ CORS Test Result:', data))
.catch(error => console.error('❌ CORS Test Failed:', error));
```

## Step 5: Test File Upload

**Only after Steps 1-4 are successful:**

1. Login to your app
2. Go to dashboard  
3. Click "Upload File"
4. Select "Abhishikth's CA5.pdf"
5. Click "Upload File" button
6. Check browser console for success

## Expected Results After Fix

✅ **Deployment Info shows version 2.0**
✅ **CORS test returns success**
✅ **No CORS errors in console**
✅ **File upload succeeds**
✅ **Console shows: "Universal CORS headers set for origin: https://fileforge-indol.vercel.app"**

## Troubleshooting

### If deployment-info returns 404:
- Deployment failed or not updated
- Force redeploy and wait 5 minutes

### If CORS test still fails:
- Check environment variables
- Verify `ALLOWED_CLIENTS` is set correctly
- Try redeploying again

### If file upload still fails after CORS works:
- Check authentication (JWT token)
- Check file size limits
- Check server logs in Vercel

## Emergency Backup Plan

If all else fails, add this to the VERY TOP of server.js (after requires):

```javascript
// EMERGENCY CORS OVERRIDE
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://fileforge-indol.vercel.app');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});
```

## Quick Status Check Commands

```bash
# Check if backend is responding
curl https://fileforge-backend.vercel.app/api/deployment-info

# Check CORS headers
curl -X OPTIONS https://fileforge-backend.vercel.app/api/files \
  -H "Origin: https://fileforge-indol.vercel.app" \
  -v
```

## Next Steps After Success

1. ✅ Verify file upload works
2. ✅ Test email sharing functionality  
3. ✅ Check files appear in dashboard
4. ✅ Test download functionality
5. ✅ Remove any emergency CORS overrides
