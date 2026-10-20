# Google Cloud Speech-to-Text Setup Guide

This guide will help you set up Google Cloud Speech-to-Text API for the voice chat feature.

## Prerequisites

- A Google Cloud account
- A Google Cloud project (create one at [console.cloud.google.com](https://console.cloud.google.com))

## Step 1: Enable Cloud Speech-to-Text API

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project (or create a new one)
3. Navigate to **APIs & Services** > **Library**
4. Search for "Cloud Speech-to-Text API"
5. Click on it and press **Enable**

## Step 2: Create a Service Account

1. In Google Cloud Console, go to **IAM & Admin** > **Service Accounts**
2. Click **Create Service Account**
3. Enter a name (e.g., "speech-to-text-service")
4. Click **Create and Continue**
5. Grant the role: **Cloud Speech-to-Text API User** (or **Editor** for broader access)
6. Click **Continue** then **Done**

## Step 3: Create and Download JSON Key

1. Find your newly created service account in the list
2. Click on it to open details
3. Go to the **Keys** tab
4. Click **Add Key** > **Create new key**
5. Select **JSON** format
6. Click **Create** - this will download a JSON file to your computer
7. **Important**: Save this file securely (e.g., `C:\path\to\your\service-account-key.json`)

## Step 4: Configure Credentials

You have two options to set up the credentials:

### Option A: Using .env file (Recommended)

1. Place your downloaded JSON key file in a secure location (e.g., `gemini-backend/keys/service-account-key.json`)
2. Add the path to your `.env` file:
   ```
   GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\your\service-account-key.json
   ```
   Or use a relative path:
   ```
   GOOGLE_APPLICATION_CREDENTIALS=keys/service-account-key.json
   ```

3. The application will automatically load this from `.env` when it starts

### Option B: Using Environment Variable

#### Windows PowerShell:
```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\to\your\service-account-key.json"
```

#### Windows Command Prompt:
```cmd
set GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\your\service-account-key.json
```

#### Mac/Linux:
```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/service-account-key.json"
```

**Note**: Environment variables set this way are only valid for the current terminal session. For permanent setup, use Option A (`.env` file).

### Option C: Using gcloud CLI (Alternative)

If you have Google Cloud SDK installed:

```bash
gcloud auth application-default login
```

This will use your personal Google account credentials instead of a service account.

## Step 5: Verify Setup

1. Start your Flask server:
   ```bash
   python app.py
   ```

2. Check the console output - it should not show any credential warnings
3. Test the `/voice` endpoint with an audio file

## Troubleshooting

### Error: "Could not automatically determine credentials"

**Solution**: Make sure:
- The path in `GOOGLE_APPLICATION_CREDENTIALS` is correct and uses forward slashes or escaped backslashes
- The JSON file exists at that path
- The JSON file is valid (not corrupted)

### Error: "Permission denied" or "403 Forbidden"

**Solution**: 
- Make sure the service account has the **Cloud Speech-to-Text API User** role
- Verify the API is enabled in your Google Cloud project

### Error: "API not enabled"

**Solution**: 
- Go to Google Cloud Console > APIs & Services > Library
- Search for "Cloud Speech-to-Text API" and enable it

## Security Notes

⚠️ **Important Security Considerations:**

1. **Never commit your service account JSON key to Git** - it's already in `.gitignore`
2. **Keep your JSON key file secure** - treat it like a password
3. **Use environment variables or `.env` file** - don't hardcode paths in your code
4. **Rotate keys periodically** - delete old keys and create new ones
5. **Limit service account permissions** - only grant the minimum required roles

## Alternative: AssemblyAI or Deepgram

If you prefer a simpler setup without service accounts, consider:
- **AssemblyAI**: HTTP-based API with API key authentication
- **Deepgram**: Similar HTTP-based approach

Both accept audio uploads via HTTP and return transcripts, making them easier for remote-hosted deployments.

## Next Steps

Once set up, your `/voice` endpoint will:
1. Accept audio files via multipart form data
2. Transcribe them using Google Speech-to-Text
3. Send the transcript to Gemini
4. Return both transcript and AI reply

Happy coding! 🎤

