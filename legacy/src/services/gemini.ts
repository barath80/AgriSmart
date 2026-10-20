// Gemini API Service - Connects to Flask backend
import { BACKEND_URL } from '../utils/backendUrl';

const GEMINI_BACKEND_URL = BACKEND_URL;

export interface GeminiResponse {
  reply: string;
  error?: string;
}

export interface GeminiRequest {
  prompt: string;
}

/**
 * Generate a response using Gemini API via Flask backend
 * @param prompt - The text prompt to send to Gemini
 * @returns The generated response text
 */
export async function generateGeminiResponse(
  prompt: string
): Promise<string> {
  try {
    const response = await fetch(`${GEMINI_BACKEND_URL}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data: GeminiResponse = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }

    return data.reply || '';
  } catch (error: any) {
    console.error('Gemini API error:', error);
    throw new Error(error.message || 'Failed to generate response from Gemini API');
  }
}

/**
 * Check if the Gemini backend is healthy
 * @returns true if backend is reachable
 */
export async function checkGeminiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${BACKEND_URL}/health`, {
      method: 'GET',
    });
    return response.ok;
  } catch (error) {
    console.error('Gemini health check failed:', error);
    return false;
  }
}

