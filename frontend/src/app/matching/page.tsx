'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SparklesIcon, XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/solid'; // Using Solid icons
import { Montserrat, Inter } from 'next/font/google'; // Import fonts

// Initialize fonts
const montserrat = Montserrat({ subsets: ['latin'], weight: ['600', '700'] }); // Semibold/Bold weights
const inter = Inter({ subsets: ['latin'] });

export default function MatchingPage() {
  const router = useRouter();

  // Added useEffect hook
  useEffect(() => {
    console.log('MatchingPage: useEffect start'); // Log added
    // Set a timer to redirect to the chat page after 3 seconds
    const timer = setTimeout(() => {
      // const mockChatId = 'mockChatId'; // Removed chatId logic
      console.log(`MatchingPage: 3 seconds elapsed, attempting to navigate to /chat`); // Log updated
      router.push(`/chat`); // Redirect to static chat page
    }, 3000); // 3000ms = 3 seconds

    // Clear the timer on component unmount (prevent memory leaks)
    return () => {
        console.log('MatchingPage: useEffect cleanup (timer cleared)'); // Log added
        clearTimeout(timer)
    };
  }, [router]); // Re-run effect only if router object changes (effectively runs once on mount)

  const handleCancelMatching = () => {
    // TODO: Need actual API call logic for cancelling matching
    // Assuming we have a userId or matchingId to send
    const mockUserId = 'user123'; // Example identifier
    console.log(`Mock API Call: Cancelling matching request for user ${mockUserId}`); // Log added
    console.log('Matching request cancelled'); // Existing log
    alert('Matching request cancelled. (Penalty may apply) (Mock)'); // Translated
    // Go back to the main screen
    router.push('/main');
  };

  return (
    <div className={`flex flex-col min-h-screen bg-black text-slate-100 items-center justify-center p-6 md:p-16 text-center ${inter.className}`}> {/* Black bg, Inter font */}
      {/* Top Text */}
      <div className="mb-8 md:mb-16">
         <h1 className={`text-3xl md:text-4xl font-bold mb-2 flex items-center justify-center gap-2 ${montserrat.className}`}> {/* Montserrat font */}
           <SparklesIcon className="h-8 w-8 md:h-10 md:w-10 text-amber-400" /> {/* Amber accent */}
           Finding your match right now {/* Translated */}
           <SparklesIcon className="h-8 w-8 md:h-10 md:w-10 text-amber-400" /> {/* Amber accent */}
        </h1>
        <p className="text-slate-400">Please wait a moment</p> {/* Adjusted text color */}
      </div>

      {/* Central Animation Area */}
      <div className="w-40 h-40 md:w-64 md:h-64 rounded-full bg-gray-950 border-4 border-amber-500 flex items-center justify-center animate-pulse mb-10 md:mb-20"> {/* Dark gray bg, Amber border */}
         {/* TODO: Add loading animation (e.g., spinner) */}
         <span className="text-slate-500 text-sm">(Searching...)</span> {/* Adjusted text color */}
      </div>

      {/* Information Text */}
      <ul className={`space-y-2 text-slate-300 mb-10 md:mb-16 list-disc list-inside text-left max-w-xs mx-auto ${montserrat.className}`}> {/* Adjusted text color, Montserrat font */}
        <li className="marker:text-amber-400">Searching for active users nearby</li> {/* Translated, Amber marker */}
        <li className="marker:text-amber-400">Profiles remain private until connected</li> {/* Translated, Amber marker */}
      </ul>

      {/* Cancel Button */}
      <div className="w-full max-w-xs mt-12 md:mt-20">
        <button
          onClick={handleCancelMatching}
          className={`w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-slate-300 font-semibold py-3 px-4 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-amber-500 ${montserrat.className}`} // Darker bg, rounded-full, Amber focus, Montserrat font, adjusted offset
        >
          <XMarkIcon className="h-5 w-5" />
          Cancel Matching Request {/* Translated */}
        </button>
        {/* Penalty Warning */}
        <p className={`mt-3 text-xs text-amber-500 flex items-center justify-center gap-1 ${montserrat.className}`}> {/* Amber text, Montserrat font */}
           <ExclamationTriangleIcon className="h-4 w-4" />
           Cancellation may result in a penalty {/* Translated */}
        </p>
      </div>
    </div>
  );
} 