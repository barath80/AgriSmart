# Gemini API Key Setup

## Current Issue

The API key in your `.env` file appears to be invalid or for a different service.

**Current key format:** `gsk_...` (This looks like a Groq API key, not a Gemini key)

**Expected format:** Gemini API keys typically start with `AIza...`

## How to Get a Valid Gemini API Key

1. **Go to Google AI Studio:**
   - Visit: https://makersuite.google.com/app/apikey
   - Or: https://aistudio.google.com/app/apikey

2. **Sign in with your Google account**

3. **Create a new API key:**
   - Click "Create API Key"
   - Select or create a Google Cloud project
   - Copy the generated API key (it will start with `AIza...`)

4. **Update your `.env` file:**
   ```
   GEMINI_API_KEY=AIza...your_actual_key_here
   MODEL_NAME=gemini-1.5-flash
   PORT=8080
   ```

5. **Restart the Flask server** to load the new key

## Valid Gemini Model Names

- `gemini-1.5-flash` (recommended - fast and free tier)
- `gemini-1.5-pro` (more capable, may have usage limits)
- `gemini-pro` (older model)

## Testing

After updating your API key, test with:

```powershell
Invoke-WebRequest -Uri http://127.0.0.1:8080/generate -Method POST -Headers @{"Content-Type"="application/json"} -Body '{"prompt": "Hello Gemini"}' | Select-Object -ExpandProperty Content
```

Or using curl (if available):
```bash
curl -X POST http://127.0.0.1:8080/generate -H "Content-Type: application/json" -d "{\"prompt\": \"Hello Gemini\"}"
```

## Troubleshooting

- **"API key not valid"**: Make sure you're using a Gemini API key, not a Groq or other service key
- **"Model not found"**: Check that MODEL_NAME is set to a valid Gemini model (see list above)
- **Server won't start**: Check that `.env` file exists and has all required variables

