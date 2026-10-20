# Fix Google OAuth "Error 400: invalid_request"

## The Problem
The error "Error 400: invalid_request" occurs because the redirect URI is not configured in Google Cloud Console.

## Solution Steps

### Step 1: Get Your Redirect URI

1. **Start your Expo app:**
   ```bash
   npx expo start
   ```

2. **Open the app in Expo Go** and navigate to Gmail Login screen

3. **Check the console/terminal** - you'll see a log like:
   ```
   🔗 Redirect URI for Google OAuth: https://auth.expo.io/@your-username/agrismart
   ```

4. **Copy this exact redirect URI** (it will look something like: `https://auth.expo.io/@username/agrismart`)

---

### Step 2: Add Redirect URI to Google Cloud Console

#### For Web Client ID:

1. Go to: **https://console.cloud.google.com**
2. Select your project: **agrismart-cc038**
3. Navigate to: **APIs & Services** > **Credentials**
4. Find your **Web Client ID**: `575013924123-1jlh4r9na1f8bi5803gj5vqhk5mmblp1`
5. Click the **Edit** icon (pencil)
6. Under **Authorized redirect URIs**, click **+ ADD URI**
7. Paste the redirect URI from Step 1 (e.g., `https://auth.expo.io/@username/agrismart`)
8. Click **Save**

#### For Android Client ID (if needed):

1. In the same **Credentials** page
2. Find your **Android Client ID**: `575013924123-bqap57hhg7561g8npbhn5v939bq15tae`
3. Click **Edit**
4. Under **Authorized redirect URIs**, add the same redirect URI
5. Click **Save**

---

### Step 3: Common Redirect URIs for Expo Go

If you're not sure what your redirect URI is, try adding these common ones:

- `https://auth.expo.io/@your-expo-username/agrismart`
- `https://auth.expo.io/@anonymous/agrismart`
- `exp://localhost:8081` (for local development)

**To find your Expo username:**
- Run: `npx expo whoami`
- Or check your Expo account at: https://expo.dev

---

### Step 4: Verify SHA-1 Fingerprint is Added

Make sure you've also added the SHA-1 fingerprint:

1. **Google Cloud Console** > **Credentials** > **Android Client ID**
   - Under **SHA-1 certificate fingerprints**, add your SHA-1

2. **Firebase Console** > **Project Settings** > **Your apps** > **Android app**
   - Click **Add fingerprint** and add your SHA-1

---

### Step 5: Test Again

1. **Wait 2-3 minutes** for Google Cloud Console changes to propagate
2. **Restart your Expo development server**
3. **Try Gmail login again**

---

## Troubleshooting

### Still getting Error 400?

1. **Double-check the redirect URI** - it must match EXACTLY (including https://)
2. **Check both Client IDs** - Web and Android both need the redirect URI
3. **Wait longer** - Google changes can take up to 5 minutes
4. **Clear app cache** - Restart Expo Go app completely
5. **Check console logs** - The redirect URI is logged when the app starts

### Common Redirect URI Formats:

- Expo Go: `https://auth.expo.io/@username/agrismart`
- Development: `exp://localhost:8081`
- Production: `com.agrismart.app://` (for standalone builds)

---

## Quick Checklist

- [ ] Redirect URI logged in console
- [ ] Redirect URI added to Web Client ID in Google Cloud Console
- [ ] Redirect URI added to Android Client ID in Google Cloud Console (if needed)
- [ ] SHA-1 fingerprint added to Android Client ID
- [ ] SHA-1 fingerprint added to Firebase Console
- [ ] Waited 2-3 minutes for changes to propagate
- [ ] Restarted Expo development server
- [ ] Tested Gmail login again

