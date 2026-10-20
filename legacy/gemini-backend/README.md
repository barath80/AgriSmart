# Gemini Backend

Flask backend for integrating with Google's Gemini API.

## Setup

1. **Create virtual environment:**
   ```bash
   python -m venv .venv
   ```

2. **Activate virtual environment:**
   - Windows: `.venv\Scripts\activate`
   - Mac/Linux: `source .venv/bin/activate`

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Create `.env` file:**
   Create a `.env` file in this directory with:
   ```
   GEMINI_API_KEY=your_real_key_here
   MODEL_NAME=gemini-2.5-flash
   PORT=8080
   GOOGLE_APPLICATION_CREDENTIALS=path/to/your/service-account-key.json
   ```
   
   **Note for Google Speech-to-Text:**
   - You need a Google Cloud service account JSON key file for speech transcription
   - See [SPEECH_SETUP.md](./SPEECH_SETUP.md) for detailed setup instructions
   - Quick setup:
     1. Enable Cloud Speech-to-Text API in [Google Cloud Console](https://console.cloud.google.com/)
     2. Create a service account and download JSON key
     3. Add to `.env`: `GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\key.json` (Windows) or `/path/to/key.json` (Mac/Linux)
   - Alternatively, set environment variable: `$env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\to\key.json"` (PowerShell)

5. **Run the server:**
   ```bash
   python app.py
   ```

The server will start on `http://localhost:8080`

## API Endpoints

### Health Check
- **GET** `/health`
- Returns: `{"ok": true}`

### Generate Response
- **POST** `/generate`
- Body: `{"prompt": "your question here"}`
- Returns: `{"reply": "generated response"}`

### Voice Chat
- **POST** `/voice`
- Content-Type: `multipart/form-data`
- Body: Form data with `audio` field containing audio file (M4A, WAV, etc.)
- Optional: `language_code` form field (default: "en-US")
- Returns: `{"transcript": "transcribed text", "reply": "generated response"}`
- Flow: Audio → Speech-to-Text → Gemini → Response

## Notes

- Make sure to add your real Gemini API key to the `.env` file
- The `.env` file is gitignored for security
- CORS is enabled to allow requests from your Expo app

