'use client';

import React, { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axiosInstance from '@/utils/axiosInstance';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    console.log('=========== AUTH CALLBACK START ===========');
    console.log('AuthCallback: useEffect running');
    console.log('AuthCallback: Current URL params:', Object.fromEntries(searchParams.entries()));
    console.log('AuthCallback: Full URL:', window.location.href);
    
    const token = searchParams.get('token');
    const error = searchParams.get('error');
    const redirectTo = searchParams.get('redirectTo');
    const isNewUser = searchParams.get('newUser') === 'true';
    
    console.log('AuthCallback: Params detected:', { 
      token: !!token, 
      error, 
      redirectTo, 
      isNewUser, 
      rawNewUser: searchParams.get('newUser')
    });
    
    if (error) {
      console.error('AuthCallback: Authentication Error:', error);
      alert(`Authentication failed: ${error}`);
      // Redirect to login page on error
      router.replace('/'); // Use replace to avoid history entry
      return;
    }

    // 신규 사용자인 경우 토큰 없이 리다이렉션 처리
    if (redirectTo) {
      console.log(`AuthCallback: Redirecting to ${redirectTo} as directed by backend`);
      router.replace(redirectTo);
      return;
    }

    // 세션 기반 신규 사용자 처리
    if (isNewUser) {
      console.log('AuthCallback: Detected new user from Google/Kakao. Redirecting to complete profile.');
      router.replace('/signup/complete-profile?isNewUser=true');
      return;
    }

    if (token) {
      console.log('AuthCallback: Received token:', token);
      // Store the token in localStorage first
      try {
        localStorage.removeItem('token'); // 기존 토큰 제거
        localStorage.setItem('token', token);
        console.log('AuthCallback: Token stored in localStorage. Token exists:', !!localStorage.getItem('token'));
      } catch (storageError) {
        console.error('AuthCallback: Error storing token in localStorage:', storageError);
      }

      // --- Fetch user info using the token with axiosInstance --- 
      console.log('AuthCallback: About to call /api/profile/me with token');
      
      // Use axiosInstance which will use the token we just saved
      axiosInstance.get('/api/profile/me')
      .then(response => {
         console.log('AuthCallback: /api/profile/me success response:', response.status);
         console.log('AuthCallback: User data received:', response.data);
         
         const userInfo = response.data as {
           id: number;
           gender?: string;
           status?: string;
           [key: string]: any;
         };
         
         // --- Store userId, gender, and status --- 
         if (userInfo && userInfo.id) {
             console.log('AuthCallback: Storing user info in localStorage: id, gender, status');
             localStorage.setItem('userId', userInfo.id.toString());
             // Store gender
             if (userInfo.gender) {
                 localStorage.setItem('userGender', userInfo.gender);
             } else {
                  localStorage.removeItem('userGender');
             }
             // Store status
             if (userInfo.status) {
                 localStorage.setItem('user', userInfo.status);
                 console.log('AuthCallback: User status stored:', userInfo.status);
             } else {
                 localStorage.removeItem('user'); // Should ideally always exist
                 console.warn('AuthCallback: User status not found in response');
             }

             console.log('AuthCallback: User info stored in localStorage');
             console.log('AuthCallback: localStorage state:', {
               token: !!localStorage.getItem('token'),
               userId: localStorage.getItem('userId'),
               userGender: localStorage.getItem('userGender'),
               userStatus: localStorage.getItem('user')
             });

             // --- Redirect based on status --- 
             if (userInfo.status === 'pending_approval') {
                 console.log('AuthCallback: User status is pending_approval. Redirecting to pending page.');
                 alert('Your account is pending administrator approval.');
                 router.replace('/auth/pending-approval'); // Redirect to pending page
             } else if (userInfo.status === 'active') {
                 console.log('AuthCallback: User status is active. Redirecting to main page.');
                 alert('Login successful! Redirecting to the main page.');
                 router.replace('/main'); // Redirect active users to main
             } else {
                 // Handle other statuses (rejected, suspended) - maybe redirect to login with message
                 console.warn(`AuthCallback: Unhandled user status: ${userInfo.status}. Redirecting to login.`);
                 localStorage.removeItem('token'); // Clear credentials
                 localStorage.removeItem('userId');
                 localStorage.removeItem('userGender');
                 localStorage.removeItem('user');
                 alert(`Your account status (${userInfo.status}) prevents login. Please contact support.`);
                 router.replace('/');
             }
             // ---------------------------------

         } else {
              // Handle case where user info or ID is missing
             console.error('AuthCallback: User info or ID missing in response from /api/profile/me', userInfo);
              // Clean up storage and redirect to login
              localStorage.removeItem('token');
              localStorage.removeItem('userId');
              localStorage.removeItem('userGender');
              localStorage.removeItem('user');
              throw new Error('Login was successful, but user information could not be retrieved.');
         }
      })
      .catch(err => {
         console.error('AuthCallback: Failed to fetch user info:', err);
         console.error('AuthCallback: Error response:', err.response?.status, err.response?.data);
         localStorage.removeItem('token');
         localStorage.removeItem('userId');
         localStorage.removeItem('userGender');
         localStorage.removeItem('user');
         alert(`An error occurred during login processing: ${err.message || '알 수 없는 오류'}. Please log in again.`);
         router.replace('/');
      });
      
      console.log('=========== AUTH CALLBACK END ===========');
      // ---------------------------------------------------

    } else {
      console.warn('AuthCallback: No token found in URL parameters. Checking for complete-profile redirect...');
      
      // 백엔드에서 신규 사용자를 감지하고 complete-profile로 리다이렉트할 가능성 감안
      // 세션 기반 리다이렉트를 위해 URL을 확인합니다
      const urlParams = new URLSearchParams(window.location.search);
      const isNewUserParam = urlParams.get('newUser') === 'true';
      const isRedirecting = urlParams.get('redirecting') === 'true';
      
      console.log('AuthCallback: URL params check:', { 
        isNewUserParam, 
        isRedirecting, 
        rawNewUser: urlParams.get('newUser'),
        fullParams: Object.fromEntries(urlParams.entries())
      });
      
      if (isNewUserParam || isRedirecting) {
        console.log('AuthCallback: Detected new user flow via URL params. Redirecting to complete profile page.');
        router.replace('/signup/complete-profile?isNewUser=true');
      } else {
        // 추가적인 확인 로직: 소셜 로그인에서는 가끔 URL 매개변수가 누락될 수 있음
        // 백엔드 로그나 다른 정보로 판단할 수 있는 부분이 있다면 여기에 추가
        
        alert('Authentication callback did not receive a token or redirect instructions.');
        // Redirect to login page if no token
        router.replace('/'); // Use replace to avoid history entry
      }
    }

  }, [router, searchParams]);

  // Display a loading message while processing
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <div className="text-center">
        <p className="text-xl font-semibold">인증 처리 중...</p>
        <p className="text-gray-400 mt-2">잠시만 기다려주세요.</p>
        {/* Optional: Add a spinner */}
      </div>
    </div>
  );
}

// Wrap the component with Suspense for useSearchParams
export default function AuthCallbackPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">Loading...</div>}>
            <AuthCallbackContent />
        </Suspense>
    );
}
