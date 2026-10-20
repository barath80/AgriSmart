# How to Get SHA-1 Fingerprint for Google Sign-In

## Method 1: Using EAS CLI (Recommended)

1. **Run the command:**
   ```bash
   eas credentials
   ```

2. **Follow the prompts:**
   - Choose: **"Manage credentials"**
   - Select platform: **"Android"**
   - Choose build profile: **"production"**
   - Choose: **"Keystore"**

3. **Copy the SHA-1 fingerprint** from the output (it looks like: `AA:BB:CC:DD:EE:FF:...`)

---

## Method 2: Using Expo Go (For Development)

If you're using Expo Go for development, you can get the SHA-1 using:

```bash
# For Windows (PowerShell)
keytool -list -v -keystore "%USERPROFILE%\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android

# For Mac/Linux
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
```

Look for the line that says **"SHA1:"** and copy that value.

---

## Method 3: Using Google Play Console (If App is Published)

If your app is already published:
1. Go to Google Play Console
2. Select your app
3. Go to **Release** > **Setup** > **App signing**
4. Copy the **SHA-1 certificate fingerprint**

---

## Where to Add SHA-1 Fingerprint

### 1. Google Cloud Console (For Android OAuth Client)

1. Go to: https://console.cloud.google.com
2. Select your project: **agrismart-cc038**
3. Navigate to: **APIs & Services** > **Credentials**
4. Find or create your **Android OAuth 2.0 Client ID**
5. Click **Edit** (pencil icon)
6. Under **SHA-1 certificate fingerprints**, click **+ ADD**
7. Paste your SHA-1 fingerprint
8. Click **Save**

### 2. Firebase Console (For Android App)

1. Go to: https://console.firebase.google.com
2. Select your project: **agrismart-cc038**
3. Click the **⚙️ Settings** icon > **Project settings**
4. Scroll down to **Your apps** section
5. Find your **Android app** (package: `com.agrismart.app`)
6. Click **Add fingerprint**
7. Paste your SHA-1 fingerprint
8. Click **Save**

---

## Important Notes

- **For Expo Go**: Use the debug keystore SHA-1 (Method 2)
- **For Production Builds**: Use the production keystore SHA-1 (Method 1)
- You may need **both** SHA-1 fingerprints (debug for development, production for release)
- After adding SHA-1, wait a few minutes for changes to propagate

---

## After Adding SHA-1

1. Restart your Expo development server
2. Try Gmail login again
3. The "Authorization Error 400" should be resolved

