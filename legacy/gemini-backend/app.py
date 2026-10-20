import os
import tempfile
import base64
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import google.generativeai as genai
from google.cloud import speech_v1p1beta1 as speech
from PIL import Image
import io

load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY")
MODEL_NAME = os.getenv("MODEL_NAME", "gemini-2.5-flash")
GOOGLE_APPLICATION_CREDENTIALS = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")

if not API_KEY:
    raise RuntimeError("GEMINI_API_KEY missing")

# Validate API key format (Gemini keys typically start with AIza)
if API_KEY and not API_KEY.startswith("AIza") and API_KEY != "your_real_key_here":
    print(f"Warning: API key format may be incorrect. Gemini keys typically start with 'AIza'")

genai.configure(api_key=API_KEY)

app = Flask(__name__)
# Enable CORS for all routes with explicit configuration
CORS(app, resources={
    r"/*": {
        "origins": "*",
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

@app.route("/health")
def health():
    print(f"[DEBUG] Health check from: {request.remote_addr}")
    return jsonify({"ok": True})

@app.route("/generate", methods=["POST", "OPTIONS"])
def generate():
    # Handle preflight OPTIONS request
    if request.method == "OPTIONS":
        return jsonify({}), 200
    
    try:
        print(f"[DEBUG] Received request from: {request.remote_addr}")
        print(f"[DEBUG] Request headers: {dict(request.headers)}")
        
        data = request.get_json(force=True)
        if not data:
            print("[ERROR] Invalid JSON body")
            return jsonify({"error": "Invalid JSON body"}), 400
            
        prompt = data.get("prompt", "")
        print(f"[DEBUG] Prompt received: {prompt[:50]}...")

        if not prompt or not prompt.strip():
            print("[ERROR] Empty prompt")
            return jsonify({"error": "Missing or empty prompt"}), 400

        try:
            # Use gemini-2.5-flash model
            print("[DEBUG] Calling Gemini API...")
            model = genai.GenerativeModel("gemini-2.5-flash")
            chat = model.start_chat(history=[])
            response = chat.send_message(prompt)

            reply = getattr(response, "text", None) or str(response)
            print(f"[DEBUG] Response received: {reply[:50]}...")

            return jsonify({"reply": reply})
        except Exception as model_error:
            error_msg = str(model_error)
            # Check for API key errors
            if "API key" in error_msg or "API_KEY" in error_msg:
                return jsonify({
                    "error": "Invalid Gemini API key. Please check your GEMINI_API_KEY in .env file.",
                    "details": error_msg
                }), 401
            # Check for model name errors
            elif "model" in error_msg.lower() or "not found" in error_msg.lower():
                return jsonify({
                    "error": f"Model '{MODEL_NAME}' not found. Try 'gemini-2.5-flash', 'gemini-1.5-flash', or 'gemini-pro'.",
                    "details": error_msg
                }), 400
            else:
                return jsonify({"error": f"Gemini API error: {error_msg}"}), 500

    except ValueError as e:
        return jsonify({"error": f"Invalid request: {str(e)}"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def transcribe_google(local_path: str, language_code: str = "en-US") -> str:
    """
    Helper: transcribe file with Google Speech-to-Text (sync for short files).
    """
    try:
        # Initialize Speech client
        # Set credentials from .env if provided, otherwise use system env var
        if GOOGLE_APPLICATION_CREDENTIALS:
            # Convert to absolute path if it's a relative path
            creds_path = os.path.abspath(GOOGLE_APPLICATION_CREDENTIALS) if not os.path.isabs(GOOGLE_APPLICATION_CREDENTIALS) else GOOGLE_APPLICATION_CREDENTIALS
            if os.path.exists(creds_path):
                os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = creds_path
            else:
                app.logger.warning(f"Credentials file not found at: {creds_path}")
        
        client = speech.SpeechClient()
        
        # Read audio file
        with open(local_path, "rb") as f:
            content = f.read()
        
        audio = speech.RecognitionAudio(content=content)
        
        # Configure recognition - use ENCODING_UNSPECIFIED to auto-detect format
        # This works for M4A, AAC, MP3, WAV, etc.
        # Note: When using ENCODING_UNSPECIFIED, sample_rate_hertz is optional
        # Google will auto-detect the sample rate, but specifying it can help
        # For mobile recordings (often 44.1kHz), we'll let Google detect it
        config = speech.RecognitionConfig(
            encoding=speech.RecognitionConfig.AudioEncoding.ENCODING_UNSPECIFIED,  # autodetect
            # sample_rate_hertz is optional with ENCODING_UNSPECIFIED - Google will detect it
            language_code=language_code,
            enable_automatic_punctuation=True,
        )
        
        # Perform recognition
        response = client.recognize(config=config, audio=audio)
        
        # Extract transcript parts
        parts = [r.alternatives[0].transcript for r in response.results if r.alternatives]
        return " ".join(parts).strip()
    
    except Exception as e:
        app.logger.exception("Transcription error")
        raise

@app.route("/voice", methods=["POST", "OPTIONS"])
def voice():
    # Handle preflight OPTIONS request
    if request.method == "OPTIONS":
        return jsonify({}), 200
    
    # Accept multipart form with field 'audio'
    if "audio" not in request.files:
        return jsonify({"error": "missing audio file"}), 400
    
    f = request.files["audio"]
    if f.filename == "":
        return jsonify({"error": "empty audio file"}), 400
    
    # Save to temp file
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".m4a")
    tmp_path = tmp.name
    tmp.close()  # Close the file handle so we can write to it
    f.save(tmp_path)
    
    try:
        # Get language code from request (optional)
        language_code = request.form.get("language_code", "en-US")
        
        # OPTIONAL: convert to WAV 16k if needed (ffmpeg). Many STT accept m4a too.
        # For now, we'll try with the original format first
        
        # Transcribe
        print(f"[DEBUG] Transcribing audio from: {tmp_path}")
        transcript = transcribe_google(tmp_path, language_code=language_code)
        print(f"[DEBUG] Transcript: {transcript[:100]}...")
        
        if not transcript:
            return jsonify({"error": "No speech detected in audio", "transcript": "", "reply": ""}), 400
        
        # Call Gemini (reuse your generate flow)
        print("[DEBUG] Calling Gemini API with transcript...")
        model = genai.GenerativeModel(MODEL_NAME)
        chat = model.start_chat(history=[])
        response = chat.send_message(transcript)
        reply_text = getattr(response, "text", None) or str(response)
        print(f"[DEBUG] Gemini reply: {reply_text[:50]}...")
        
        return jsonify({"transcript": transcript, "reply": reply_text})
    
    except Exception as e:
        app.logger.exception("voice error")
        return jsonify({"error": str(e)}), 500
    
    finally:
        # Clean up temp file
        try:
            os.unlink(tmp_path)
        except Exception:
            pass

@app.route("/pest/detect", methods=["POST", "OPTIONS"])
def pest_detect():
    # Handle preflight OPTIONS request
    if request.method == "OPTIONS":
        return jsonify({}), 200
    
    try:
        print(f"[DEBUG] Pest detection request from: {request.remote_addr}")
        
        # Check if request has JSON data or form data
        image_data = None
        description = ""
        
        if request.is_json:
            data = request.get_json(force=True)
            # Image can be sent as base64 string
            image_data = data.get("image")
            description = data.get("description", "")
        else:
            # Check for file upload
            if "image" in request.files:
                file = request.files["image"]
                if file.filename:
                    image_data = file.read()
            elif "image" in request.form:
                # Base64 encoded image in form data
                image_data = request.form.get("image")
            description = request.form.get("description", "")
        
        # Validate that we have either image or description
        if not image_data and not description.strip():
            return jsonify({
                "success": False,
                "error": "Please provide either an image or description of the pest"
            }), 400
        
        # Prepare the prompt for pest detection
        pest_prompt = """Analyze this agricultural pest/disease image and provide a detailed response in the following JSON format:
{
  "pestName": "Name of the pest or disease",
  "whyOccurring": "Detailed explanation of why this pest/disease is occurring (environmental factors, causes, conditions)",
  "recommendations": [
    "Recommendation 1 for curing/treating the pest",
    "Recommendation 2 for curing/treating the pest",
    "Recommendation 3 for curing/treating the pest"
  ]
}

Provide real, accurate agricultural information based on the image. Focus on:
1. Accurate pest/disease identification
2. Root causes and environmental factors
3. Practical, actionable treatment recommendations
4. Organic and chemical treatment options where applicable

If the image is not clear or you cannot identify the pest, please indicate that in the response."""

        # Add description to prompt if provided
        if description.strip():
            pest_prompt += f"\n\nAdditional context provided by user: {description}"
        
        try:
            # Initialize Gemini model
            print("[DEBUG] Initializing Gemini model for pest detection...")
            model = genai.GenerativeModel("gemini-2.5-flash")
            
            # Prepare content with image if available
            if image_data:
                # Handle base64 encoded image
                if isinstance(image_data, str):
                    # Remove data URL prefix if present
                    if image_data.startswith('data:image'):
                        image_data = image_data.split(',')[1]
                    
                    # Decode base64
                    try:
                        image_bytes = base64.b64decode(image_data)
                        image = Image.open(io.BytesIO(image_bytes))
                    except Exception as e:
                        print(f"[ERROR] Failed to decode base64 image: {e}")
                        return jsonify({
                            "success": False,
                            "error": "Invalid image format. Please provide a valid image."
                        }), 400
                else:
                    # Image is already bytes
                    image = Image.open(io.BytesIO(image_data))
                
                # Convert image to format suitable for Gemini
                # Save to bytes
                img_byte_arr = io.BytesIO()
                # Convert to RGB if necessary (Gemini requires RGB)
                if image.mode != 'RGB':
                    image = image.convert('RGB')
                image.save(img_byte_arr, format='JPEG')
                img_byte_arr.seek(0)
                
                # Generate content with image
                print("[DEBUG] Calling Gemini API with image...")
                response = model.generate_content([pest_prompt, image])
            else:
                # Text-only analysis
                print("[DEBUG] Calling Gemini API with text description...")
                response = model.generate_content(pest_prompt)
            
            # Extract response text
            response_text = getattr(response, "text", None) or str(response)
            print(f"[DEBUG] Gemini response received: {response_text[:200]}...")
            
            # Try to parse JSON from response
            import json
            import re
            
            # Extract JSON from response (in case there's extra text)
            json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', response_text, re.DOTALL)
            if json_match:
                try:
                    result_data = json.loads(json_match.group())
                except json.JSONDecodeError:
                    # If JSON parsing fails, create structured response from text
                    result_data = {
                        "pestName": "Unknown Pest",
                        "whyOccurring": response_text,
                        "recommendations": response_text.split('\n')[:5]
                    }
            else:
                # No JSON found, create structured response
                result_data = {
                    "pestName": "Unknown Pest",
                    "whyOccurring": response_text,
                    "recommendations": [line.strip() for line in response_text.split('\n') if line.strip()][:5]
                }
            
            # Ensure recommendations is a list
            if isinstance(result_data.get("recommendations"), str):
                result_data["recommendations"] = [result_data["recommendations"]]
            elif not isinstance(result_data.get("recommendations"), list):
                result_data["recommendations"] = []
            
            return jsonify({
                "success": True,
                "result": result_data
            })
            
        except Exception as model_error:
            error_msg = str(model_error)
            print(f"[ERROR] Gemini API error: {error_msg}")
            
            # Check for API key errors
            if "API key" in error_msg or "API_KEY" in error_msg:
                return jsonify({
                    "success": False,
                    "error": "Invalid Gemini API key. Please check your GEMINI_API_KEY in .env file.",
                    "details": error_msg
                }), 401
            
            return jsonify({
                "success": False,
                "error": f"Error analyzing pest image: {error_msg}"
            }), 500
            
    except Exception as e:
        print(f"[ERROR] Pest detection error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8080))
    print(f"[INFO] Starting Flask server on 0.0.0.0:{port}")
    print(f"[INFO] Backend URL: http://0.0.0.0:{port}")
    print(f"[INFO] Model: {MODEL_NAME}")
    print(f"[INFO] API Key: {'Set' if API_KEY else 'Missing'}")
    
    # Check Google Speech-to-Text credentials
    if GOOGLE_APPLICATION_CREDENTIALS:
        creds_path = os.path.abspath(GOOGLE_APPLICATION_CREDENTIALS) if not os.path.isabs(GOOGLE_APPLICATION_CREDENTIALS) else GOOGLE_APPLICATION_CREDENTIALS
        if os.path.exists(creds_path):
            print(f"[INFO] Google Speech-to-Text: Credentials found at {creds_path}")
        else:
            print(f"[WARNING] Google Speech-to-Text: Credentials file not found at {creds_path}")
            print("[WARNING] Voice endpoint (/voice) will not work without valid credentials")
            print("[INFO] See SPEECH_SETUP.md for setup instructions")
    elif os.getenv("GOOGLE_APPLICATION_CREDENTIALS"):
        # Check if set as system environment variable
        print(f"[INFO] Google Speech-to-Text: Using system environment variable")
    else:
        print("[WARNING] Google Speech-to-Text: No credentials configured")
        print("[WARNING] Voice endpoint (/voice) will not work without credentials")
        print("[INFO] Set GOOGLE_APPLICATION_CREDENTIALS in .env or as environment variable")
        print("[INFO] See SPEECH_SETUP.md for setup instructions")
    
    app.run(host="0.0.0.0", port=port, debug=True)

