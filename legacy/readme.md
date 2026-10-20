# AgriSmart - The AI-Powered Farming Companion

AgriSmart is a comprehensive smart farming mobile application built using React Native (Expo) that empowers farmers with AI-driven insights, real time weather updates, IoT based soil testing, and multilingual accessibility.

This intelligent assistant helps farmers make informed decisions about crop management, pest and disease control, market trends, and government schemes   all in one unified, easy to use platform.

## Key highlights
1. AI +IOT integration
2. Multilingual Support (English, Hindi, Tamil &amp; more)
3. Offline Caching for Key Data
4. Cross-Platform (Android / iOS)
5. Real-Time Weather &amp; IoT Data Feeds
6. Interactive Community for Farmers

## Features Overview
1. Crop Recommendation:
    AI model suggests the most suitable crops for the user's region and soil type.
    Inputs include temperature, humidity, soil moisture, and pH (via IoT or manual entry).
    Supports region-based dynamic crop prediction using machine learning.

2. Pest Detection:
Detects crop pests through image recognition.
Farmers can upload a photo of the affected plant, and the AI identifies the pest species.
Provides control measures and recommended pesticides.

3. Disease Detection:
Uses deep learning (CNN-based models) to detect crop diseases from leaf images.
Offers treatment steps, chemical and organic remedies, and prevention advice.
Works offline for known disease categories.

4. Market Prices:
Displays real-time commodity market prices for various crops across regions.
Helps farmers choose the best time and place to sell their produce.
Includes historical data and trend charts.

5. Profit &amp; Loss Calculator:
Calculates estimated profit or loss based on crop yield, cost of production, and market price.
Provides insight into optimizing farming costs and improving revenue.

6. Community Forum:
A social platform for farmers to connect, share experiences, and discuss farming issues.
Multilingual posts supported.
Includes moderation and topic tagging (pest control, fertilizers, schemes, etc.).

7. Weather Information:
Powered by WeatherAPI.com with 7-day forecast and real-time conditions
Displays temperature, humidity, wind speed, pressure, soil moisture (estimated), and UV index.
Region-specific forecasts cached for performance.

8. AI Chatbot Assistant:
A smart conversational assistant that helps with:
Crop suggestions
Government scheme details
Farming techniques
Market queries
Uses Natural Language Processing (NLP) for context-aware responses.
Voice-enabled with Speech-to-Text (STT) and Text-to-Speech (TTS) capabilities.

9. Smart Farming Calendar:
Manages sowing and harvesting schedules, weather alerts, and reminders.
Auto-syncs with local time zones.
Integrated with crop cycle data and AI recommendations.

10. Soil Testing (IoT Integration):
Connected IoT device measures:
Soil pH, 
Moisture, 
Nutrient levels, 
Temperature
Sends data to the app via Wi-Fi or BLE.
AI models analyze results and provide personalized fertilizer and crop suggestions.

11. Farmer Course (Learning Hub):
Offers curated video and text courses on modern farming techniques.
Includes topics like organic farming, irrigation methods, drone usage, etc.
Multilingual educational content for easy accessibility.

12. Fertilizer &amp; Crop Rotation Planner:
Suggests appropriate fertilizers based on soil composition and crop type.
Helps plan crop rotation cycles to improve soil health and reduce pest risks.
Integrates with IoT soil data and crop history.

13. Government Schemes:
Displays current agricultural and subsidy schemes from central and state governments.
Links to application forms and eligibility information.
Updated regularly through API integration.

14. Yield Prediction:
Uses machine learning models to predict expected yield based on:
Weather data, 
Soil conditions, 
Crop type and growth stage.
Helps farmers plan logistics and market timing.

15. AI Smart Helpline:
24/7 AI-powered virtual helpline that answers farming-related queries.
Provides localized support and emergency guidance (e.g., flood or drought alerts).
Available in multiple languages.

16. Smart Mapping:
Provides geolocation-based farm insights:
Soil type, 
Nearby markets, 
Irrigation zones, 
Integrates Google Maps for navigation to nearby agro-shops and storage units.


## Multilingual Support
AgriSmart supports multiple languages including:

1. English 

2. Hindi 

3. Tamil

4. Telugu

5. Kannada

6. Marathi

Language detection is automatic, with manual switching available in settings.


## Tech Stack

1. Front end - React Native (Expo)
2. Backend - Node.js + Express (Vercel serverless)
3. AI Modules - TensorFlow.js / Python API endpoints
4. Database - Firebase / Firestore
5. IoT Integration - ESP32 / NodeMCU + MQTT / DTH11
6. API Integrations - WeatherAPI, Government Schemes API
7. Authentication - Firebase Auth (Email/Google)
8. Speech - Google STT / Expo Speech for TTS
9. Hosting - Vercel (Backend) + Expo Go (Frontend)

## IoT Soil Sensor Workflow

1. IoT device collects soil data (pH, moisture, temperature).
2. Sends it to AgriSmart via MQTT or Wi-Fi.
3. Backend analyzes the data using trained AI models.
4. The app displays real-time soil condition and crop recommendations.

## Installation &amp; Setup

```bash
# Clone the repository
git clone https://github.com/&lt;your-username&gt;/agrismart.git

# Install dependencies
cd agrismart
npm install

# Add your API keys in .env
EXPO_PUBLIC_WEATHER_API_KEY=your_api_key_here

# Run app
npx expo start

# Run backend locally
cd backend
vercel dev --listen 3000
```



