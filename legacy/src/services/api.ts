// API Client for making HTTP requests
// Uses axios-like interface but can be replaced with fetch or other HTTP client

interface ApiResponse<T = any> {
  data: {
    success: boolean;
    result?: T;
    recommendation?: T;
    message?: string;
    error?: string;
  };
  status: number;
  statusText: string;
}

class ApiClient {
  private baseURL: string;
  private timeout: number;

  constructor(baseURL: string = 'http://localhost:3000/api', timeout: number = 30000) {
    this.baseURL = baseURL;
    this.timeout = timeout;
  }

  private async request<T = any>(
    method: string,
    url: string,
    data?: any,
    headers?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    try {
      const fullUrl = url.startsWith('http') ? url : `${this.baseURL}${url}`;
      
      const requestOptions: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: data ? JSON.stringify(data) : undefined,
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      try {
        const response = await fetch(fullUrl, {
          ...requestOptions,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const responseData = await response.json().catch(() => {
          throw new Error('Invalid JSON response from server');
        });

        return {
          data: responseData,
          status: response.status,
          statusText: response.statusText,
        };
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        // Handle specific error types
        if (fetchError.name === 'AbortError') {
          throw new Error('Request timeout: Server took too long to respond');
        }
        if (fetchError.message?.includes('Network request failed') || 
            fetchError.message?.includes('Failed to fetch')) {
          throw new Error('Network error: Unable to connect to server. Please check your internet connection.');
        }
        throw fetchError;
      }
    } catch (error: any) {
      // Log error but don't expose sensitive details
      console.error('API request error:', error.message);
      
      // Return a user-friendly error message
      if (error.message) {
        throw error;
      }
      throw new Error('Network error: Unable to connect to API server');
    }
  }

  async get<T = any>(url: string, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>('GET', url, undefined, headers);
  }

  async post<T = any>(
    url: string,
    data?: any,
    headers?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    return this.request<T>('POST', url, data, headers);
  }

  async put<T = any>(
    url: string,
    data?: any,
    headers?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', url, data, headers);
  }

  async delete<T = any>(url: string, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', url, undefined, headers);
  }

  async patch<T = any>(
    url: string,
    data?: any,
    headers?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', url, data, headers);
  }
}

// Create and export a singleton instance
import { API_BASE_URL, API_TIMEOUT } from '../config/api';

const apiClient = new ApiClient(API_BASE_URL, API_TIMEOUT);

export default apiClient;

