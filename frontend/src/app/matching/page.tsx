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
    const token = localStorage.getItem('authToken');
    if (!token) {
      console.error('MatchingPage: No auth token found. Redirecting to login.');
      setError('인증 토큰이 없습니다. 로그인이 필요합니다.');
      setIsConnecting(false);
      // Optionally redirect to login page
      // router.push('/auth/login'); 
      return;
    }

    // Connect to the Socket.IO server
    // Ensure the URL points to your backend server
    socketRef.current = io('http://localhost:3001', { // Replace with your backend URL
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
         setError('서버와의 연결이 끊어졌습니다. 다시 시도해주세요.');
      }
    });

    socket.on('connect_error', (err: Error) => {
      console.error('MatchingPage: Socket connection error:', err.message);
      setIsConnecting(false);
      setIsConnected(false);
      setIsWaiting(false);
      if (err.message.includes('Authentication error')) {
          setError('인증에 실패했습니다. 다시 로그인해주세요.');
          // Optionally clear token and redirect to login
          // localStorage.removeItem('authToken');
          // router.push('/auth/login');
      } else {
          setError('서버에 연결할 수 없습니다.');
      }
    });

    socket.on('match-success', (data: MatchData) => {
      console.log('MatchingPage: Match success!', data);
      setIsWaiting(false);
      // Navigate to the chat page with the matchId as a query parameter
      router.push(`/chat?matchId=${data.matchId}`); // Changed to query parameter
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
    alert('매칭 요청이 취소되었습니다.'); // More direct feedback
    router.push('/main'); // Go back to the main screen
  };

  // --- Render Logic ---
  let statusText = '서버에 연결 중...';
  if (!isConnecting && error) {
    statusText = `오류: ${error}`;
  } else if (isConnected && isWaiting) {
    statusText = '매칭 상대를 찾고 있습니다...';
  } else if (!isConnected && !isConnecting) {
      statusText = '연결 끊김. 다시 시도해주세요.';
  }

  return (
    <div className={`flex flex-col min-h-screen bg-black text-slate-100 items-center justify-center p-6 md:p-16 text-center ${inter.className}`}> {/* Black bg, Inter font */}
      {/* Top Text */}
      <div className="mb-8 md:mb-16">
         <h1 className={`text-3xl md:text-4xl font-bold mb-2 flex items-center justify-center gap-2 ${montserrat.className}`}> {/* Montserrat font */}
           <SparklesIcon className="h-8 w-8 md:h-10 md:w-10 text-amber-400" /> {/* Amber accent */}
           {isWaiting ? '매칭 상대를 찾는 중' : (error ? '매칭 오류' : '연결 중...')}
           <SparklesIcon className="h-8 w-8 md:h-10 md:w-10 text-amber-400" /> {/* Amber accent */}
        </h1>
        <p className="text-slate-400">{statusText}</p> {/* Adjusted text color */}
      </div>

      {/* Central Animation Area */}
      <div className={`w-40 h-40 md:w-64 md:h-64 rounded-full bg-gray-950 border-4 border-amber-500 flex items-center justify-center ${isWaiting || isConnecting ? 'animate-pulse' : ''} mb-10 md:mb-20`}> {/* Dark gray bg, Amber border */}
        {isConnecting && <span className="text-slate-500 text-sm">(연결 중...)</span>}
        {isConnected && isWaiting && <span className="text-slate-500 text-sm">(검색 중...)</span>}
        {error && <ExclamationTriangleIcon className="h-16 w-16 text-red-500" />}
         {!isConnecting && !isConnected && !error && <span className="text-slate-500 text-sm">(연결 끊김)</span>}
      </div>

      {/* Information Text (Show only when waiting) */}
      {(isWaiting || isConnecting) && !error && (
        <ul className={`space-y-2 text-slate-300 mb-10 md:mb-16 list-disc list-inside text-left max-w-xs mx-auto ${montserrat.className}`}> {/* Adjusted text color, Montserrat font */}
          <li className="marker:text-amber-400">근처의 활동 중인 사용자를 찾고 있습니다</li> {/* Translated, Amber marker */}
          <li className="marker:text-amber-400">연결될 때까지 프로필은 비공개로 유지됩니다</li> {/* Translated, Amber marker */}
        </ul>
      )}

       {/* Error Display */}
       {error && (
           <div className="text-red-400 mb-10 md:mb-16 max-w-xs mx-auto">
               <p>{error}</p>
               {error.includes("로그인") && <button onClick={() => router.push('/auth/login')} className="mt-2 text-amber-400 underline">로그인 페이지로 이동</button>}
           </div>
       )}

      {/* Cancel Button (Show unless there's a non-auth error after connection attempt) */}
       { (!error || (error && error.includes('인증'))) && // Show cancel unless connection totally failed
           <div className="w-full max-w-xs mt-12 md:mt-20">
               <button
                 onClick={handleCancelMatching}
                 disabled={!isConnected && !isConnecting} // Disable if not connected or trying to connect
                 className={`w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-slate-300 font-semibold py-3 px-4 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-amber-500 ${montserrat.className} disabled:opacity-50 disabled:cursor-not-allowed`}
               >
                 <XMarkIcon className="h-5 w-5" />
                 매칭 요청 취소
               </button>
               {/* Penalty Warning */}
                <p className={`mt-3 text-xs text-amber-500 flex items-center justify-center gap-1 ${montserrat.className}`}> 
                   <ExclamationTriangleIcon className="h-4 w-4" />
                   취소 시 페널티가 부과될 수 있습니다
               </p>
           </div>
       }
    </div>
  );
} 