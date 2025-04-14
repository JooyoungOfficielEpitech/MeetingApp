'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { SparklesIcon, XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/solid'; // Using Solid icons
import { Montserrat, Inter } from 'next/font/google'; // Import fonts
import io, { Socket } from 'socket.io-client'; // Import socket.io-client

// Initialize fonts
const montserrat = Montserrat({ subsets: ['latin'], weight: ['600', '700'] }); // Semibold/Bold weights
const inter = Inter({ subsets: ['latin'] });

// Define interface for match data
interface MatchData {
  matchId: string;
  opponentId: number;
  // Add other opponent details if needed
}

export default function MatchingPage() {
  const router = useRouter();
  const socketRef = useRef<Socket | null>(null); // Ref to store socket instance

  // State variables
  const [isConnecting, setIsConnecting] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Removed isMatched state as we navigate immediately on match

  useEffect(() => {
    console.log('MatchingPage: useEffect start - initiating socket connection');
    setError(null); // Clear previous errors

    // Retrieve token from local storage
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('MatchingPage: No auth token found. Redirecting to login.');
      setError('Authentication token not found. Login required.');
      setIsConnecting(false);
      // Optionally redirect to login page
      // router.push('/auth/login'); 
      return;
    }

    // Connect to the Socket.IO server
    // Ensure the URL points to your backend server
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
    socketRef.current = io(socketUrl, { // Use environment variable
      auth: { token },
      reconnectionAttempts: 3, // Limit reconnection attempts
    });

    const socket = socketRef.current;

    // --- Socket Event Handlers ---
    socket.on('connect', () => {
      console.log('MatchingPage: Socket connected successfully. ID:', socket.id);
      setIsConnecting(false);
      setIsConnected(true);
      setIsWaiting(true); // Assume waiting starts immediately after connection
      setError(null);
      // Automatically request matching upon connection
      console.log('MatchingPage: Emitting start-matching event.');
      socket.emit('start-matching');
    });

    socket.on('disconnect', (reason: string) => {
      console.log('MatchingPage: Socket disconnected. Reason:', reason);
      setIsConnecting(false);
      setIsConnected(false);
      setIsWaiting(false);
      // Handle unexpected disconnects if necessary
      if (reason !== 'io client disconnect') {
         setError('Connection to server lost. Please try again.');
      }
    });

    socket.on('connect_error', (err: Error) => {
      console.error('MatchingPage: Socket connection error:', err.message);
      setIsConnecting(false);
      setIsConnected(false);
      setIsWaiting(false);
      if (err.message.includes('Authentication error')) {
          setError('Authentication failed. Please log in again.');
          // Optionally clear token and redirect to login
          // localStorage.removeItem('authToken');
          // router.push('/auth/login');
      } else {
          setError('Cannot connect to the server.');
      }
    });

    socket.on('match-success', (data: MatchData) => {
      console.log('MatchingPage: Match success!', data);
      setIsWaiting(false);
      // Navigate to the chat page using the dynamic route path
      router.push(`/chat/${data.matchId}`); // Corrected to use dynamic route path
    });

    socket.on('waiting-for-match', () => {
      console.log('MatchingPage: Waiting for match...');
      setIsWaiting(true); // Explicitly set waiting state
      setError(null);
    });

    socket.on('already-waiting', () => {
        console.log('MatchingPage: Already waiting.');
        setIsWaiting(true); // Stay in waiting state
        // Optionally show a small notification
    });

    socket.on('matching-error', (errorMessage: string) => {
      console.error('MatchingPage: Matching error:', errorMessage);
      setError(errorMessage);
      setIsWaiting(false);
    });

    // --- Cleanup Function ---
    return () => {
      console.log('MatchingPage: useEffect cleanup - disconnecting socket');
      if (socketRef.current) {
        // Remove all listeners before disconnecting
        socketRef.current.off('connect');
        socketRef.current.off('disconnect');
        socketRef.current.off('connect_error');
        socketRef.current.off('match-success');
        socketRef.current.off('waiting-for-match');
        socketRef.current.off('already-waiting');
        socketRef.current.off('matching-error');
        socketRef.current.disconnect();
        socketRef.current = null; // Clear the ref
      }
    };
  }, [router]); // Dependency array includes router

  const handleCancelMatching = () => {
    console.log('MatchingPage: User clicked cancel.');
    if (socketRef.current && isConnected) {
      // Optional: Send a cancel event to the backend
      // socketRef.current.emit('cancel-matching');
      // console.log('MatchingPage: Emitted cancel-matching event.');

      // Disconnect the socket manually
      socketRef.current.disconnect();
      console.log('MatchingPage: Manually disconnected socket.');
    }
    alert('Matching request cancelled.'); // More direct feedback
    router.push('/main'); // Go back to the main screen
  };

  // --- Render Logic ---
  let statusText = 'Connecting to server...';
  if (!isConnecting && error) {
    statusText = `Error: ${error}`;
  } else if (isConnected && isWaiting) {
    statusText = 'Finding a match...';
  } else if (!isConnected && !isConnecting) {
      statusText = 'Disconnected. Please try again.';
  }

  return (
    <div className={`flex flex-col min-h-screen bg-black text-slate-100 items-center justify-center p-6 md:p-16 text-center ${inter.className}`}> {/* Black bg, Inter font */}
      {/* Top Text */}
      <div className="mb-8 md:mb-16">
         <h1 className={`text-3xl md:text-4xl font-bold mb-2 flex items-center justify-center gap-2 ${montserrat.className}`}> {/* Montserrat font */}
           <SparklesIcon className="h-8 w-8 md:h-10 md:w-10 text-amber-400" /> {/* Amber accent */}
           {isWaiting ? 'Finding Match' : (error ? 'Matching Error' : 'Connecting...')}
           <SparklesIcon className="h-8 w-8 md:h-10 md:w-10 text-amber-400" /> {/* Amber accent */}
        </h1>
        <p className="text-slate-400">{statusText}</p> {/* Adjusted text color */}
      </div>

      {/* Central Animation Area */}
      <div className={`w-40 h-40 md:w-64 md:h-64 rounded-full bg-gray-950 border-4 border-amber-500 flex items-center justify-center ${isWaiting || isConnecting ? 'animate-pulse' : ''} mb-10 md:mb-20`}> {/* Dark gray bg, Amber border */}
        {isConnecting && <span className="text-slate-500 text-sm">(Connecting...)</span>}
        {isConnected && isWaiting && <span className="text-slate-500 text-sm">(Searching...)</span>}
        {error && <ExclamationTriangleIcon className="h-16 w-16 text-red-500" />}
         {!isConnecting && !isConnected && !error && <span className="text-slate-500 text-sm">(Disconnected)</span>}
      </div>

      {/* Information Text (Show only when waiting) */}
      {(isWaiting || isConnecting) && !error && (
        <ul className={`space-y-2 text-slate-300 mb-10 md:mb-16 list-disc list-inside text-left max-w-xs mx-auto ${montserrat.className}`}> {/* Adjusted text color, Montserrat font */}
          <li className="marker:text-amber-400">Searching for active users nearby</li> {/* Translated, Amber marker */}
          <li className="marker:text-amber-400">Your profile remains private until connected</li> {/* Translated, Amber marker */}
        </ul>
      )}

       {/* Error Display */}
       {error && (
           <div className="text-red-400 mb-10 md:mb-16 max-w-xs mx-auto">
               <p>{error}</p>
               {error.includes("Login required") && <button onClick={() => router.push('/')} className="mt-2 text-amber-400 underline">Go to Login Page</button>}
           </div>
       )}

      {/* Cancel Button (Show unless there's a non-auth error after connection attempt) */}
       { (!error || (error && error.includes('Authentication failed'))) && // Show cancel unless connection totally failed
           <div className="w-full max-w-xs mt-12 md:mt-20">
               <button
                 onClick={handleCancelMatching}
                 disabled={!isConnected && !isConnecting} // Disable if not connected or trying to connect
                 className={`w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-slate-300 font-semibold py-3 px-4 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-amber-500 ${montserrat.className} disabled:opacity-50 disabled:cursor-not-allowed`}
               >
                 <XMarkIcon className="h-5 w-5" />
                 Cancel Matching Request
               </button>
               {/* Penalty Warning */}
                <p className={`mt-3 text-xs text-amber-500 flex items-center justify-center gap-1 ${montserrat.className}`}> 
                   <ExclamationTriangleIcon className="h-4 w-4" />
                   A penalty may apply upon cancellation
               </p>
           </div>
       }
    </div>
  );
} 