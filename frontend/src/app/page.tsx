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
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (email === 'root@root' && password === 'root') {
      console.log('Admin login successful');
      alert('Redirecting to admin dashboard.');
      router.push('/admin');
      return;
    }
    console.log('Attempting general user login (Mock)');
    console.log({ email, password, rememberMe });
    alert('Login successful (Mock)');
    router.push('/main');
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
           <span className={`text-5xl font-bold text-amber-400 ${montserrat.className}`}>Logo</span> {/* Apply Montserrat Bold to Logo */}
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

          {/* Log In Button */}
          <div>
            <button
              type="submit"
              className={`${buttonBaseStyle} bg-amber-500 hover:bg-amber-600 text-slate-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-amber-500 ${montserrat.className} font-semibold`} // Apply Montserrat Semibold to Button 
            >
              Log In
            </button>
          </div>

          {/* Secure Connection */}
          <div className="flex items-center justify-center text-xs text-slate-500">
             <ShieldCheckIcon className="h-4 w-4 mr-1 text-slate-500" aria-hidden="true" />
             <span>Secure connection</span>
          </div>
        </form>
      </div>
    </div>
  );
}
