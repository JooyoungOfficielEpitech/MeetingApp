import axios from 'axios';

// Define the base URL for your backend API
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'; // Use environment variable or default

// Create an Axios instance
const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 10초에서 30초로 타임아웃 증가
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add the auth token to headers
axiosInstance.interceptors.request.use(
  (config) => {
    // Check if the request data is FormData
    if (config.data instanceof FormData) {
      // If it's FormData, delete the Content-Type header.
      // Axios will automatically set it to multipart/form-data with the correct boundary.
      if (config.headers) {
        delete config.headers['Content-Type'];
      }
    }

    // Check if window is defined (runs only on client-side)
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        // Log token details for debugging (without exposing full token)
        const tokenParts = token.split('.');
        if (tokenParts.length === 3) {
          try {
            // 토큰에서 payload 디코딩하여 자세한 정보 확인 (만료시간, 사용자 ID 등)
            const payload = JSON.parse(atob(tokenParts[1]));
            console.log('[Axios] Token info:', {
              exp: payload.exp ? new Date(payload.exp * 1000).toLocaleString() : 'N/A',
              userId: payload.userId || 'N/A',
              email: payload.email ? `${payload.email.substring(0, 3)}...` : 'N/A'
            });
            
            // 토큰 만료 확인
            if (payload.exp && payload.exp * 1000 < Date.now()) {
              console.warn('[Axios] Token expired. Clearing from localStorage...');
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              
              // 경고 표시
              if (config.url !== '/api/auth/login') {
                alert('세션이 만료되었습니다. 다시 로그인해주세요.');
                window.location.href = '/';
                // 요청은 계속 진행하고 백엔드에서 만료된 토큰을 처리하도록 함
              }
            }
          } catch (e) {
            console.error('[Axios] Error parsing token payload:', e);
          }
        }
        
        // Ensure headers object exists
        config.headers = config.headers || {};
        config.headers['Authorization'] = `Bearer ${token}`;
      } else {
        console.log('[Axios] No token found in localStorage');
      }
    } else {
      console.log('[Axios] Running on server-side or window not available.');
    }
    return config;
  },
  (error) => {
    // Handle request error
    console.error('[Axios Request Interceptor] Error:', error);
    return Promise.reject(error);
  }
);

// Optional: Response interceptor for global error handling or data transformation
axiosInstance.interceptors.response.use(
  (response) => {
    // Any status code that lie within the range of 2xx cause this function to trigger
    // console.log('[Axios Response Interceptor] Response received:', response.status);
    return response;
  },
  (error) => {
    // Any status codes that falls outside the range of 2xx cause this function to trigger
    console.error('[Axios Response Interceptor] Error:', error.response?.status, error.response?.data);

    // 특정 오류 유형별 처리
    if (error.response) {
      const { status, data } = error.response;
      
      // "User associated with this token not found" 오류 처리
      if (status === 404 && data?.message === 'User associated with this token not found.' && typeof window !== 'undefined') {
        console.error('[Axios] User associated with token not found. This may indicate a database synchronization issue or deleted account.');
        
        // 토큰 제거
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('userId');
        localStorage.removeItem('isAdmin');
        
        // 사용자에게 알림
        alert('계정 정보를 찾을 수 없습니다. 다시 로그인해주세요.');
        
        // 로그인 페이지로 이동
        if (window.location.pathname !== '/') {
          window.location.href = '/';
        }
        
        // 이미 처리된 오류임을 표시
        return Promise.reject({ ...error, handled: true });
      }
      
      // 토큰 관련 오류 (인증 실패, 만료 등)
      if (status === 401 || status === 403) {
        console.warn('[Axios] Authentication error:', data?.message);
        
        // 토큰 제거
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('userId');
          localStorage.removeItem('isAdmin');
          
          // 로그인 페이지로 이동 (이미 로그인 페이지가 아닌 경우)
          if (window.location.pathname !== '/') {
            console.log('[Axios] Redirecting to login page...');
            window.location.href = '/';
          }
        }
        
        // 이미 처리된 오류임을 표시
        return Promise.reject({ ...error, handled: true });
      }
    }

    // Return a rejected promise to allow specific error handling in components
    return Promise.reject(error);
  }
);

export default axiosInstance;