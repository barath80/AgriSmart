# Gemini Backend Setup Guide

## Quick Start

### 1. Create Virtual Environment

```bash
cd HK-37/gemini-backend
python -m venv .venv
```

### 2. Activate Virtual Environment

**Windows:**
```bash
.venv\Scripts\activate
```

**Mac/Linux:**
```bash
source .venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Create `.env` File

Create a `.env` file in the `gemini-backend` directory with:

```
GEMINI_API_KEY=your_real_gemini_api_key_here
MODEL_NAME=gemini-2.5-flash
PORT=8080
```

**Important:** 
- Replace `your_real_gemini_api_key_here` with your actual Gemini API key
- Get your API key from: https://makersuite.google.com/app/apikey
- The `.env` file is gitignored for security

### 5. Run the Server

```bash
python app.py
```

The server will start on `http://localhost:8080`

## Testing

### Test Health Endpoint

```bash
curl http://localhost:8080/health
```

Expected response: `{"ok": true}`

### Test Generate Endpoint

```bash
curl -X POST http://localhost:8080/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is farming?"}'
```

Expected response: `{"reply": "..."}`

## Connecting Expo App

The Expo app is already configured to connect to this backend. The service is located at:
- `src/services/gemini.ts` (in the same HK-37 project)

Make sure:
1. The Flask backend is running on port 8080
2. For Android emulator, the backend URL uses `10.0.2.2:8080` (already configured)
3. For iOS simulator, use `localhost:8080` (already configured)

## Troubleshooting

### Port Already in Use
If port 8080 is already in use, change the `PORT` value in your `.env` file.

### CORS Errors
CORS is already enabled in the Flask app. If you still see CORS errors, make sure `flask-cors` is installed.

### API Key Issues
- Make sure your `.env` file is in the `gemini-backend` directory
- Verify the API key is correct and has proper permissions
- Check that the key doesn't have extra spaces or quotes

### Model Name
If `gemini-2.5-flash` doesn't work, try:
- `gemini-1.5-flash`
- `gemini-1.5-pro`
- `gemini-pro`

Update the `MODEL_NAME` in your `.env` file.

