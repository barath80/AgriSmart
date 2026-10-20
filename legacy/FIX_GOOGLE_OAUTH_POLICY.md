# Fix Google OAuth "Access blocked: Authorization Error - Error 400: invalid_request"

## The Problem
Google is blocking your app because it doesn't comply with OAuth 2.0 policy. This usually means:
1. OAuth consent screen is not properly configured
2. App is in "Testing" mode but user is not added as a test user
3. App needs to be published/verified

## Solution: Configure OAuth Consent Screen

### Step 1: Configure OAuth Consent Screen

1. **Go to Google Cloud Console:**
   - https://console.cloud.google.com
   - Select project: **agrismart-cc038**

2. **Navigate to OAuth consent screen:**
   - Go to: **APIs & Services** > **OAuth consent screen**

3. **Configure the consent screen:**

   **User Type:**
   - Choose: **External** (for testing with any Google account)
   - OR **Internal** (only if you have Google Workspace)

   **App Information:**
   - App name: **AgriSmart**
   - User support email: **Your email**
   - App logo: (optional)
   - App domain: (optional)
   - Application home page: (optional)
   - Privacy policy link: (optional for testing)
   - Terms of service link: (optional for testing)
   - Authorized domains: (add your domain if you have one)

   **Developer contact information:**
   - Email addresses: **Your email**

4. **Click "Save and Continue"**

---

### Step 2: Add Scopes

1. **In OAuth consent screen, go to "Scopes"**
2. **Click "Add or Remove Scopes"**
3. **Add these scopes:**
   - `openid`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
4. **Click "Update"**
5. **Click "Save and Continue"**

---

### Step 3: Add Test Users (IMPORTANT!)

If your app is in **Testing** mode:

1. **In OAuth consent screen, go to "Test users"**
2. **Click "+ ADD USERS"**
3. **Add your Google account email:** `dev035364@gmail.com`
4. **Add any other test users**
5. **Click "Add"**
6. **Click "Save and Continue"**

**Note:** Only test users can sign in when app is in Testing mode!

---

### Step 4: Publishing Status

**For Development/Testing:**
- Keep app in **Testing** mode
- Add all test users in Step 3
- This allows up to 100 test users

**For Production:**
- Click **"PUBLISH APP"** button
- This makes it available to all users
- May require verification if using sensitive scopes

---

### Step 5: Verify Redirect URIs

1. **Go to: APIs & Services > Credentials**
2. **Edit your Web Client ID:**
   - Client ID: `575013924123-1jlh4r9na1f8bi5803gj5vqhk5mmblp1`
   - Under **Authorized redirect URIs**, add:
     - `https://auth.expo.io/@your-username/agrismart`
     - Or check console for the exact redirect URI
3. **Edit your Android Client ID:**
   - Client ID: `575013924123-bqap57hhg7561g8npbhn5v939bq15tae`
   - Package name: `com.agrismart.app`
   - SHA-1 fingerprint: (must be added)

---

### Step 6: Common Redirect URIs for Expo

Add these redirect URIs to your **Web Client ID**:

```
https://auth.expo.io/@your-expo-username/agrismart
https://auth.expo.io/@anonymous/agrismart
exp://localhost:8081
```

**To find your Expo username:**
```bash
npx expo whoami
```

---

### Step 7: Quick Fix Checklist

- [ ] OAuth consent screen configured (User Type, App Info, Developer Contact)
- [ ] Scopes added (openid, email, profile)
- [ ] Test users added (if in Testing mode) - **CRITICAL!**
- [ ] Redirect URIs added to Web Client ID
- [ ] SHA-1 fingerprint added to Android Client ID
- [ ] App published OR test users added
- [ ] Waited 5-10 minutes for changes to propagate

---

## Most Common Issue: Test Users Not Added

**If your app is in "Testing" mode, you MUST add test users!**

1. Go to: **OAuth consent screen > Test users**
2. Click **"+ ADD USERS"**
3. Add: `dev035364@gmail.com`
4. Save

**Without test users, Google will block all sign-in attempts!**

---

## Alternative: Publish the App

If you want anyone to sign in (not just test users):

1. Go to: **OAuth consent screen**
2. Click **"PUBLISH APP"** button
3. Confirm publishing
4. Wait 5-10 minutes

**Note:** Publishing may require app verification if using sensitive scopes.

---

## Still Not Working?

1. **Check the exact error** - Click "error details" link in the error message
2. **Verify redirect URI** - Check console logs for exact URI
3. **Wait longer** - Google changes can take 10-15 minutes
4. **Clear browser cache** - Try in incognito/private mode
5. **Check app status** - OAuth consent screen should show "Testing" or "In production"

