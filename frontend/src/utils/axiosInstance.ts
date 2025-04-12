import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

// Define the base URL for your backend API
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'; // Use environment variable or default

// Create an Axios instance
const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000, // Optional: Set a request timeout (e.g., 10 seconds)
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add the auth token to headers
axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Check if window is defined (runs only on client-side)
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('authToken');
      if (token) {
        // Ensure headers object exists
        config.headers = config.headers || {};
        config.headers['Authorization'] = `Bearer ${token}`;
        // console.log('[Axios Request Interceptor] Token added to headers');
      } else {
        // console.log('[Axios Request Interceptor] No token found in localStorage');
      }
    } else {
      // console.log('[Axios Request Interceptor] Running on server-side or window not available.');
    }
    return config;
  },
  (error: AxiosError) => {
    // Handle request error
    console.error('[Axios Request Interceptor] Error:', error);
    return Promise.reject(error);
  }
);

// Optional: Response interceptor for global error handling or data transformation
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => {
    // Any status code that lie within the range of 2xx cause this function to trigger
    // console.log('[Axios Response Interceptor] Response received:', response.status);
    return response;
  },
  (error: AxiosError) => {
    // Any status codes that falls outside the range of 2xx cause this function to trigger
    console.error('[Axios Response Interceptor] Error:', error.response?.status, error.response?.data);

    // Example: Redirect to login on 401 Unauthorized
    if (error.response?.status === 401 && typeof window !== 'undefined') {
       console.warn('[Axios Response Interceptor] Unauthorized access detected. Clearing token and redirecting to login.');
       localStorage.removeItem('authToken');
       localStorage.removeItem('userStatus');
       // Redirect only if not already on the login page
       if (window.location.pathname !== '/') {
          window.location.href = '/'; // Force redirect for simplicity, or use router if available/needed
       }
       // Prevent further error propagation by returning a specific object or null
       // Return a rejected promise, but signal it's handled to avoid duplicate alerts/actions
       return Promise.reject({ ...error, handled: true });
    }

    // Return a rejected promise to allow specific error handling in components
    return Promise.reject(error);
  }
);

export default axiosInstance;