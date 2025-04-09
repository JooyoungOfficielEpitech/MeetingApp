'use client';

import React, { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (error) {
      console.error('Authentication Error:', error);
      alert(`Authentication failed: ${error}`);
      // Redirect to login page on error
      router.replace('/'); // Use replace to avoid history entry
      return;
    }

    if (token) {
      console.log('Received token:', token);
      // Store the token in localStorage first
      localStorage.setItem('authToken', token);
      console.log('Token stored in localStorage. Fetching user info...');

      // --- Fetch user info using the token --- 
      fetch('http://localhost:3001/api/users/me', { // Ensure correct backend URL
        method: 'GET', // Added method for clarity
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(async res => { 
         if (!res.ok) {
             // Try to parse error message from backend
             let errorMsg = `Failed to fetch user info: ${res.status} ${res.statusText}`;
             try {
                 const errorBody = await res.json();
                 if (errorBody && errorBody.message) {
                     errorMsg = errorBody.message;
                 }
             } catch { /* Ignore JSON parsing error */ }
             // Throw error to be caught below
             throw new Error(errorMsg);
         }
         return res.json(); // Parse successful response
      })
      .then(userInfo => {
         // --- Store userId --- 
         if (userInfo && userInfo.id) {
             localStorage.setItem('userId', userInfo.id.toString()); // Store userId
             console.log('User info fetched and userId stored.', userInfo);
             // Optionally store the whole userInfo if needed elsewhere
             // localStorage.setItem('userInfo', JSON.stringify(userInfo));

             // Redirect AFTER successfully fetching info and storing userId
             alert('로그인 성공! 메인 페이지로 이동합니다.');
             router.replace('/main');
         } else {
              // Handle case where user info or ID is missing in response
             console.error('User info or ID missing in response from /api/users/me', userInfo);
              throw new Error('로그인은 성공했지만 사용자 정보를 가져올 수 없습니다.');
         }
         // -------------------
      })
      .catch(err => {
         console.error('Failed to fetch user info after callback:', err);
         localStorage.removeItem('authToken'); // Remove potentially invalid token
         localStorage.removeItem('userId');   // Clear userId as well
         // localStorage.removeItem('userInfo');
         alert(`로그인 처리 중 오류가 발생했습니다: ${err.message}. 다시 로그인해주세요.`);
         router.replace('/'); // Redirect to login
      });
      // ---------------------------------------------------
      
      // --- Remove the immediate redirect below, it happens inside .then() or .catch() now ---
      // alert('로그인 성공! 메인 페이지로 이동합니다.');
      // router.replace('/main');

    } else {
      console.warn('No token found in URL parameters.');
      alert('Authentication callback did not receive a token.');
      // Redirect to login page if no token
      router.replace('/'); // Use replace to avoid history entry
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
