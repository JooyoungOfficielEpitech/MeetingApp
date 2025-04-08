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
      // Store the token in localStorage
      localStorage.setItem('authToken', token);
      console.log('Token stored in localStorage.');

      // --- Optional: Fetch user info using the token --- 
      // You might want to fetch /api/users/me here to get user details
      // and store them in state management or context if needed immediately.
      // Example:
      // fetch('http://localhost:3001/api/users/me', { headers: { 'Authorization': `Bearer ${token}` } }) // Use full backend URL
      //   .then(async res => { 
      //      if (!res.ok) { throw new Error(`Failed to fetch user info: ${res.statusText}`) } 
      //      return res.json(); 
      //   })
      //   .then(userInfo => {
      //      localStorage.setItem('userInfo', JSON.stringify(userInfo));
      //      console.log('User info stored after token validation.', userInfo);
      //      router.replace('/main'); // Redirect after storing user info
      //   })
      //   .catch(err => {
      //      console.error('Failed to fetch user info after callback:', err);
      //      localStorage.removeItem('authToken'); // Remove invalid token
      //      alert('Login successful, but failed to fetch user details. Please log in again.');
      //      router.replace('/'); // Redirect to login
      //   });
      // ---------------------------------------------------
      
      // Redirect to the main application page (if not fetching user info here)
       alert('로그인 성공! 메인 페이지로 이동합니다.');
       router.replace('/main'); // Use replace to avoid history entry

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
