'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { UserCircleIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import { Montserrat, Inter } from 'next/font/google'; // Import fonts
import axiosInstance from '@/utils/axiosInstance'; // Use axiosInstance
import io, { Socket } from 'socket.io-client'; // Import socket.io-client

// Initialize fonts
const montserrat = Montserrat({ subsets: ['latin'], weight: ['600', '700'] }); // Semibold/Bold weights
const inter = Inter({ subsets: ['latin'] });

// User profile data structure (adjust as needed)
interface UserProfile {
    id: number;
    email: string;
    name: string;
    gender: 'male' | 'female' | null;
    status: string;
    // ... other fields
}

// WebSocket update payload structure
interface MatchUpdatePayload {
    status: 'matched' | 'finding' | 'idle' | 'waiting';
    matchId?: string;
}

export default function MainPage() {
  const router = useRouter();
  const socketRef = useRef<Socket | null>(null);
  console.log("MainPage: Component rendering");

  // --- State Variables --- 
  const [isLoading, setIsLoading] = useState(true); // General loading state
  const [error, setError] = useState<string | null>(null); // General error state
  const [userInfo, setUserInfo] = useState<UserProfile | null>(null); // User info (incl. gender)
  const [isFindingMatchFemale, setIsFindingMatchFemale] = useState(false); // Is FEMALE user actively finding (after clicking start)?
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null); // Store active match ID if user already has one
  // --- End State Variables ---

  // --- WebSocket Connection Effect --- 
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.log("MainPage: No token found, cannot connect WebSocket.");
      // Redirect or handle missing token appropriately
      // router.push('/'); // Example redirect
      return; // Prevent connection attempt
    }

    // Ensure environment variable is available client-side
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001'; 
    console.log(`MainPage: Connecting WebSocket to ${socketUrl}`);

    // Initialize socket connection
    // Pass token in auth. No initial matchId needed for main page socket.
    const socket = io(socketUrl, {
        auth: { token },
        // Consider adding reconnection options if needed
        // reconnectionAttempts: 5,
        // reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    // --- Socket Event Listeners ---
    socket.on('connect', () => {
      console.log('MainPage: WebSocket connected, ID:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('MainPage: WebSocket disconnected, Reason:', reason);
      // Optionally handle disconnection (e.g., show message, attempt reconnect)
    });

    socket.on('connect_error', (err) => {
      console.error('MainPage: WebSocket connection error:', err.message);
      setError('Connection error. Please try again later.');
      // Handle specific errors like auth failure
      if (err.message.includes('Authentication error')) {
           // Maybe force logout?
           localStorage.removeItem('token');
           router.push('/');
      }
    });

    socket.on('match_update', (payload: MatchUpdatePayload) => {
      console.log('[WebSocket] Received match_update event with payload:', payload);
      try {
          switch (payload.status) {
            case 'matched':
              console.log('[WebSocket] Updating state: matched, matchId:', payload.matchId);
              setActiveMatchId(payload.matchId || null);
              setIsFindingMatchFemale(false); 
              break;
            case 'finding': 
              console.log('[WebSocket] Updating state: finding (female)');
              setActiveMatchId(null);
              setIsFindingMatchFemale(true);
              break;
            case 'idle': 
              console.log('[WebSocket] Updating state: idle');
              setActiveMatchId(null);
              setIsFindingMatchFemale(false);
              break;
            case 'waiting': 
              console.log('[WebSocket] Updating state: waiting (male)');
              setActiveMatchId(null);
              setIsFindingMatchFemale(false); 
              break;
            default:
              console.warn('MainPage: Received unknown match_update status:', payload.status);
          }
          console.log('[WebSocket] State update potentially successful.');
      } catch (stateUpdateError) {
            console.error('[WebSocket] Error updating state after receiving match_update:', stateUpdateError);
      }
    });

    // --- Cleanup on unmount --- 
    return () => {
      console.log("MainPage: Disconnecting WebSocket on unmount.");
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('match_update');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [router]); // Dependency on router to handle redirects

  // --- Fetch User Info and Initial Match Status (runs once) --- 
  useEffect(() => {
    console.log("MainPage: useEffect fetching initial user info and match status...");
    setIsLoading(true);
    setError(null);
    setActiveMatchId(null);
    setIsFindingMatchFemale(false); 

    const fetchInitialData = async () => {
      try {
          const profileResponse = await axiosInstance.get<UserProfile>('/api/profile/me');
          const fetchedUser = profileResponse.data;
          setUserInfo(fetchedUser);
          console.log("MainPage: User info fetched:", fetchedUser);

          // Still need to check initial active match via HTTP
          if (fetchedUser && fetchedUser.id) { 
              console.log(`MainPage: Checking initial active match status for user ${fetchedUser.id}...`);
              try {
                  const matchCheckResponse = await axiosInstance.get<{ matchId: string } | null>('/api/matches/active'); 
                  console.log("MainPage: /api/matches/active response status:", matchCheckResponse.status);
                  if (matchCheckResponse.status === 200 && matchCheckResponse.data?.matchId) {
                      console.log("MainPage: Found existing active match on load:", matchCheckResponse.data.matchId);
                      setActiveMatchId(matchCheckResponse.data.matchId);
                  } else {
                       // Catch cases where API might return 2xx without matchId (should ideally be 404)
                       console.log("MainPage: No existing active match found on load (Non-200 or no matchId).");
                       setActiveMatchId(null);
                  }
              } catch (matchError: any) {
                  // Log the actual error received
                  console.error("MainPage: Error during /api/matches/active call:", matchError.response?.status, matchError.response?.data || matchError.message);
                  if (matchError.response?.status === 404) {
                       console.log("MainPage: No existing active match found on load (404 received).");
                       setActiveMatchId(null); // Explicitly set null on 404
                  } else {
                       // For other errors, don't assume no match, log error prominently
                       console.error("MainPage: Unexpected error checking initial match status (/active).");
                       setError("Failed to check current match status."); // Show error to user
                       // Do NOT set activeMatchId to null here, as we don't know the actual state
                  }
              }
          }
      } catch (err: any) {
          console.error('MainPage: Failed to fetch initial data:', err);
          setError(err.response?.data?.message || 'Failed to load user data.');
          if (err.response?.status === 401 || err.response?.status === 403) {
              localStorage.removeItem('token');
              router.push('/');
          }
      } finally {
          setIsLoading(false);
      }
    };

    fetchInitialData();

    // No cleanup needed here as it runs only once
  }, []); // Empty dependency array ensures this runs only once on mount

  // --- Handler Functions --- 

  const handleStartMatch = async () => {
    if (isLoading || isFindingMatchFemale || userInfo?.gender !== 'female') return;
    console.log("MainPage: handleStartMatch called (Female)");
    // Optimistic UI update (optional, could rely solely on websocket)
    // setIsFindingMatchFemale(true);
    setIsLoading(true); // Show loading indicator during API call
    setError(null);

    try {
      // No need to clear interval here
      await axiosInstance.post('/api/matches/start');
      // Backend will send 'match_update' via WebSocket on success (200 or 202)
      console.log("MainPage: /api/matches/start request sent.");
    } catch (err: any) {
      console.error("MainPage: Error starting match (Female):", err);
      setError(err.response?.data?.message || '매칭 시작 중 오류가 발생했습니다.');
      // Reset optimistic UI if needed
      // setIsFindingMatchFemale(false);
    } finally {
      setIsLoading(false); // Hide loading indicator
    }
  };

  const handleStopMatch = async () => {
    if (isLoading || !isFindingMatchFemale || userInfo?.gender !== 'female') return;
    console.log("MainPage: handleStopMatch called (Female)");
    setIsLoading(true);
    setError(null);

    try {
       // No need to clear interval here
       await axiosInstance.post('/api/matches/stop');
       // Backend will send 'match_update' via WebSocket on success
       console.log("MainPage: /api/matches/stop request sent.");
    } catch (err: any) { 
        console.error("MainPage: Error stopping match (Female):", err);
        setError(err.response?.data?.message || '매칭 중단 중 오류가 발생했습니다.');
    } finally {
        setIsLoading(false);
    }
  };

  const handleProfileClick = () => {
    router.push('/profile'); // Navigate to profile page
  };

  // --- Determine Button Text and Action --- 
  let buttonText = 'Loading...';
  let buttonAction: () => void = () => {};
  let isButtonDisabled = true;

  if (!isLoading) {
      if (activeMatchId) {
          buttonText = 'Go to Chat Room';
          buttonAction = () => router.push(`/chat/${activeMatchId}`);
          isButtonDisabled = false;
      } else if (userInfo?.gender === 'female') {
          if (isFindingMatchFemale) { // Check female finding state (set by websocket)
              buttonText = 'Stop Finding Match';
              buttonAction = handleStopMatch;
              isButtonDisabled = false;
          } else {
              buttonText = 'Start Matching';
              buttonAction = handleStartMatch;
              isButtonDisabled = false; 
          }
      } else if (userInfo?.gender === 'male') {
          // Male users: Show disabled "Finding" state unless active match found
          buttonText = 'Finding Opponent...'; 
          buttonAction = () => {}; // No action for male button click
          isButtonDisabled = true; 
      } else {
           // User profile not loaded or gender is null
           buttonText = 'Complete Profile'; 
           buttonAction = handleProfileClick; // Go to profile if gender is missing
           isButtonDisabled = false;
      }
  }

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center bg-black text-slate-100 px-4 py-12 ${inter.className}`}>
       {/* Profile Icon Top Right (Placeholder) */}
       <button onClick={handleProfileClick} className="absolute top-6 right-6 text-slate-400 hover:text-amber-400">
         <UserCircleIcon className="h-8 w-8" />
       </button>

      <div className="text-center max-w-md w-full">
        {/* Logo or App Name */}
        <div className="mb-12">
           {/* Placeholder for Logo */}
          <div className="w-24 h-24 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full mx-auto flex items-center justify-center shadow-lg mb-4">
             <span className={`text-4xl font-bold text-black ${montserrat.className}`}>N</span>
          </div>
          <h1 className={`text-4xl font-bold text-slate-100 ${montserrat.className}`}>App Name</h1> 
          <p className="text-slate-400 mt-2">Find your connection.</p>
        </div>

        {/* Match Button */} 
        <div className="mb-8">
          <button
            onClick={buttonAction}
            disabled={isButtonDisabled}
            className={`w-full px-8 py-4 rounded-full text-lg font-semibold transition-all duration-300 ease-in-out shadow-lg hover:shadow-xl disabled:opacity-60 disabled:cursor-not-allowed ${isFindingMatchFemale ? 'bg-gray-600 hover:bg-gray-500 text-white' : 'bg-amber-500 hover:bg-amber-600 text-black'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-amber-400`}
          >
            {isLoading ? 'Loading...' : buttonText}
          </button>
           {/* Keep indicator for female finding state */} 
           {isFindingMatchFemale && (
                 <p className="text-sm text-amber-400 mt-4 animate-pulse">Searching for match...</p>
            )}
            {error && <p className="text-sm text-red-400 mt-4">Error: {error}</p>} 
        </div>

        {/* Info Text (Optional) */}
        {/* 
        <div className="text-slate-500 text-sm">
          <p>현재 접속자: ... 명</p>
          <p>예상 매칭 시간: ...</p>
        </div>
         */}
      </div> 
    </div> 
  );
} 