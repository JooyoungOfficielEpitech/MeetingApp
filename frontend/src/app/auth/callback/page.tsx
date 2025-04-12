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
      fetch('http://localhost:3001/api/profile/me', { // Changed URL to /api/profile/me
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
         // --- Store userId, gender, and status --- 
         if (userInfo && userInfo.id) {
             localStorage.setItem('userId', userInfo.id.toString());
             // Store gender
             if (userInfo.gender) {
                 localStorage.setItem('userGender', userInfo.gender);
             } else {
                  localStorage.removeItem('userGender');
             }
             // Store status
             if (userInfo.status) {
                 localStorage.setItem('userStatus', userInfo.status);
                 console.log('User status stored:', userInfo.status);
             } else {
                 localStorage.removeItem('userStatus'); // Should ideally always exist
                 console.warn('User status not found in response from /api/profile/me');
             }

             console.log('User info fetched and stored.', userInfo);

             // --- Redirect based on status --- 
             if (userInfo.status === 'pending_approval') {
                 console.log('User status is pending_approval. Redirecting to pending page.');
                 alert('Your account is pending administrator approval.');
                 router.replace('/auth/pending-approval'); // Redirect to pending page
             } else if (userInfo.status === 'active') {
                 console.log('User status is active. Redirecting to main page.');
                 alert('Login successful! Redirecting to the main page.');
                 router.replace('/main'); // Redirect active users to main
             } else {
                 // Handle other statuses (rejected, suspended) - maybe redirect to login with message
                 console.warn(`Unhandled user status: ${userInfo.status}. Redirecting to login.`);
                 localStorage.removeItem('authToken'); // Clear credentials
                 localStorage.removeItem('userId');
                 localStorage.removeItem('userGender');
                 localStorage.removeItem('userStatus');
                 alert(`Your account status (${userInfo.status}) prevents login. Please contact support.`);
                 router.replace('/');
             }
             // ---------------------------------

         } else {
              // Handle case where user info or ID is missing
             console.error('User info or ID missing in response from /api/profile/me', userInfo);
              // Clean up storage and redirect to login
              localStorage.removeItem('authToken');
              localStorage.removeItem('userId');
              localStorage.removeItem('userGender');
              localStorage.removeItem('userStatus');
              throw new Error('Login was successful, but user information could not be retrieved.');
         }
      })
      .catch(err => {
         console.error('Failed to fetch user info or process status after callback:', err);
         localStorage.removeItem('authToken');
         localStorage.removeItem('userId');
         localStorage.removeItem('userGender');
         localStorage.removeItem('userStatus');
         alert(`An error occurred during login processing: ${err.message}. Please log in again.`);
         router.replace('/');
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
        <p className="text-xl font-semibold">Processing authentication...</p>
        <p className="text-gray-400 mt-2">Please wait a moment.</p>
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
