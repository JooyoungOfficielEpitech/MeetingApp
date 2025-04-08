'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LockClosedIcon, EnvelopeIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import { Montserrat, Inter } from 'next/font/google'; // Import fonts

// Initialize fonts
const montserrat = Montserrat({ subsets: ['latin'], weight: ['700', '800'] }); // Bold weights
const inter = Inter({ subsets: ['latin'] });

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Keep the admin check if needed
    if (email === 'root@root' && password === 'root') {
      console.log('Admin login successful');
      // Maybe store admin status differently
      // sessionStorage.setItem('isAdmin', 'true');
      alert('Redirecting to admin dashboard.');
      router.push('/admin');
      setIsLoading(false);
      return;
    }

    console.log('Attempting general user login');

    try {
        const response = await fetch('http://localhost:3001/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || '로그인에 실패했습니다. 이메일 또는 비밀번호를 확인해주세요.');
        }

        console.log('Login successful:', data);

        // --- Store the JWT Token --- 
        // Use localStorage for persistence across browser sessions
        // Consider sessionStorage if token should clear when the tab/window is closed
        // For more robust solutions, explore state management libraries (Zustand, Redux)
        if (data.token) {
            localStorage.setItem('authToken', data.token);
            // Optionally store basic user info if needed frequently, but avoid sensitive data
            localStorage.setItem('userInfo', JSON.stringify(data.user)); 
            console.log('Token and user info stored in localStorage');
        } else {
            console.warn('No token received from server');
            throw new Error('로그인 응답에 토큰이 없습니다.');
        }
        // --------------------------- 

        alert('로그인 성공!');
        router.push('/main'); // Redirect to main application page

    } catch (error: any) {
        console.error('Login Error:', error);
        setError(error.message || '로그인 중 오류가 발생했습니다.');
    } finally {
        setIsLoading(false);
    }
  };

  // Styles reflecting new reference image (Slate background, Amber accent)
  const inputBaseStyle = "w-full p-3 pl-10 rounded-full bg-slate-700 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 border border-slate-600 focus:border-amber-500 transition-colors"; // Fully rounded inputs
  const labelStyle = "block text-sm font-medium text-slate-400 mb-1.5";
  const buttonBaseStyle = "w-full py-3 px-4 rounded-full font-semibold transition-colors duration-200"; // Fully rounded button
  const iconWrapperStyle = "absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none";

  return (
    <div className={`min-h-screen bg-black text-slate-100 flex items-center justify-center py-16 px-4 sm:px-6 lg:px-8 ${inter.className}`}> {/* Apply Inter font globally */}
      <div className="max-w-sm w-full space-y-8 bg-gray-950 p-10 rounded-2xl shadow-xl"> {/* Moderately rounded card (rounded-2xl) */}
        {/* Simple Text Logo Example with New Accent Color */}
        <div className="text-center">
           {/* Replace with your actual logo if available */}
           <span className={`text-5xl font-bold text-amber-400 ${montserrat.className}`}>Lo??ㅇㅇ?go</span> {/* Apply Montserrat Bold to Logo */}
           {/* <p className="mt-1 text-sm text-slate-400">CoffeeMeetsBagel</p> Optional Tagline */}
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          {/* Email */}
          <div>
            <label htmlFor="email" className={labelStyle}>Email</label>
            <div className="relative mt-1">
              <div className={iconWrapperStyle}>
                <EnvelopeIcon className="h-5 w-5 text-slate-500" aria-hidden="true" />
              </div>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className={inputBaseStyle} // Amber focus style applied
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          {/* Password */}
           <div>
            <label htmlFor="password" className={labelStyle}>Password</label>
             <div className="relative mt-1">
               <div className={iconWrapperStyle}>
                 <LockClosedIcon className="h-5 w-5 text-slate-500" aria-hidden="true" />
               </div>
               <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className={inputBaseStyle} // Amber focus style applied
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {/* Remember me / Forgot password? */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className="h-4 w-4 text-amber-500 focus:ring-amber-400 border-slate-600 rounded bg-slate-700" // Amber accent checkbox
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <label htmlFor="remember-me" className="ml-2 block text-slate-300">
                Remember me
              </label>
            </div>

            <div className="text-sm">
              <Link href="/find-password" legacyBehavior>
                 <a className="font-medium text-amber-400 hover:text-amber-300"> {/* Amber accent link */} 
                   Forgot password?
                 </a>
              </Link>
            </div>
          </div>

          {/* Display error message */}
          {error && (
              <div className="text-red-400 text-sm text-center p-2 bg-red-900 bg-opacity-40 rounded-md">
                  {error}
              </div>
          )}

          {/* Log In Button */}
          <div>
            <button
              type="submit"
              disabled={isLoading}
              className={`${buttonBaseStyle} bg-amber-500 hover:bg-amber-600 text-slate-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-amber-500 ${montserrat.className} font-semibold ${isLoading ? 'opacity-60 cursor-not-allowed' : ''}`} // Apply Montserrat Semibold to Button 
            >
              {isLoading ? 'Logging In...' : 'Log In'}
            </button>
          </div>

          {/* Link to Sign Up */} 
           <div className="text-center text-sm">
                <span className="text-slate-400">Don't have an account? </span>
                <Link href="/signup" legacyBehavior>
                   <a className="font-medium text-amber-400 hover:text-amber-300">
                       Sign up
                   </a>
                </Link>
            </div>

          {/* Secure Connection */}
          <div className="flex items-center justify-center text-xs text-slate-500">
             <ShieldCheckIcon className="h-4 w-4 mr-1 text-slate-500" aria-hidden="true" />
             <span>Secure connection</span>
          </div>
        </form>
        
        {/* --- OR Separator --- */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-700"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-gray-950 text-slate-500">Or continue with</span>
          </div>
        </div>
        {/* -------------------- */}

        {/* --- Social Login Buttons --- */}
        <div>
          <a 
            href="http://localhost:3001/api/auth/google" // Link to backend Google auth route
            className={`${buttonBaseStyle} mt-3 flex items-center justify-center bg-red-600 hover:bg-red-700 text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-red-500`}
          >
             {/* Simple Google Icon Placeholder */} 
             <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.16H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.84l3.66-2.75z"/>
                <path d="M12 5.38c1.63 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.16l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                <path d="M1 1h22v22H1z" fill="none"/>
             </svg>
            <span>Sign in with Google</span>
          </a>
          {/* Add buttons for Facebook, Kakao later */} 
        </div>
        {/* ------------------------- */}

      </div>
    </div>
  );
}
