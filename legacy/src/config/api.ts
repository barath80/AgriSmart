// API Configuration and Endpoints
import { Platform } from 'react-native';

export const API_BASE_URL = __DEV__ 
  ? 'http://localhost:3000/api' // Development API URL
  : 'https://api.agrismart.com/api'; // Production API URL

// Gemini Backend URL (Flask server)
export const GEMINI_BACKEND_URL = __DEV__
  ? 'http://localhost:8080' // Development Gemini backend
  : 'https://gemini-backend.agrismart.com'; // Production Gemini backend

// For Android emulator, use 10.0.2.2 instead of localhost
// For iOS simulator, use localhost
// For physical device, use your computer's IP address
const getBackendUrl = () => {
  if (__DEV__) {
    if (Platform.OS === 'android') {
      return 'http://10.0.2.2:8080'; // Android emulator
    }
    return 'http://localhost:8080'; // iOS simulator or web
  }
  return 'https://gemini-backend.agrismart.com'; // Production
};
export const PEST_DETECTION_BACKEND_URL = getBackendUrl();

export const API_ENDPOINTS = {
  // Crop Recommendation
  CROP_RECOMMEND: '/crop/recommend',
  
  // Disease Detection
  DISEASE_DETECT: '/disease/detect',
  
  // Pest Detection
  PEST_DETECT: '/pest/detect',
  
  // Weather
  WEATHER: '/weather',
  WEATHER_FORECAST: '/weather/forecast',
  
  // Market Prices
  MARKET_PRICES: '/market/prices',
  
  // Soil Test
  SOIL_TEST: '/soil/test',
  
  // Yield Prediction
  YIELD_PREDICT: '/yield/predict',
  
  // AI Assistant
  AI_CHAT: '/ai/chat',
  
  // User
  USER_PROFILE: '/user/profile',
  USER_UPDATE: '/user/update',
} as const;

export const API_TIMEOUT = 30000; // 30 seconds

// ML Server URL for crop recommendation and yield prediction
const getMLServerUrl = () => {
  if (__DEV__) {
    if (Platform.OS === 'android') {
      return 'http://10.0.2.2:5001'; // Android emulator
    }
    return 'http://localhost:5001'; // iOS simulator or web
  }
  // Check for environment variable for physical devices
  if (process.env.EXPO_PUBLIC_ML_SERVER_URL) {
    return process.env.EXPO_PUBLIC_ML_SERVER_URL;
  }
  return 'https://ml-server.agrismart.com'; // Production
};

export const ML_SERVER_URL = getMLServerUrl();

