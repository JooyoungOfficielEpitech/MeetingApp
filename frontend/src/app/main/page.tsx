'use client';

import React, { useState, useEffect, useRef } from 'react';
import { UserCircleIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import { Montserrat, Inter } from 'next/font/google'; // Import fonts
import io, { Socket } from 'socket.io-client'; // Import socket.io-client

// Initialize fonts
const montserrat = Montserrat({ subsets: ['latin'], weight: ['600', '700'] }); // Semibold/Bold weights
const inter = Inter({ subsets: ['latin'] });

interface ButtonState {
    button_display: string;
    active: boolean;
    matchId: string | null;
}

interface MatchSuccessData { matchId: string; opponentId: number; }

export default function MainPage() {
  const router = useRouter();
  // Rename existing socketRef for temporary matching socket
  const tempSocketRef = useRef<Socket | null>(null); 
  // Add a new ref for the persistent main page socket
  const mainSocketRef = useRef<Socket | null>(null);
  console.log("MainPage: Component rendering");

  // --- State for Button --- 
  const [buttonState, setButtonState] = useState<ButtonState | null>(null);
  const [isLoadingButtonState, setIsLoadingButtonState] = useState(true);
  const [isAttemptingMatch, setIsAttemptingMatch] = useState(false);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  // Add state for main socket connection status
  const [isMainSocketConnected, setIsMainSocketConnected] = useState(false);

  // Mock data
  const activeUsers = 127;
  const estimatedTime = '2-3 min';

  // --- Fetch Button State from API --- 
  useEffect(() => {
    console.log("MainPage: useEffect fetching button state...");
    setIsLoadingButtonState(true);
    const token = localStorage.getItem('authToken');

    if (!token) {
        console.log('MainPage: No token found, redirecting to login.');
        setIsLoadingButtonState(false);
        // Optionally clear state and redirect
        setButtonState({ button_display: 'Login Required', active: false, matchId: null });
        // router.push('/'); 
        return;
    }

    const fetchButtonState = async () => {
        try {
            const response = await fetch('http://localhost:3001/api/main/button-state', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            console.log("MainPage: API /button-state response status:", response.status);

            if (response.ok) {
                const data: ButtonState = await response.json();
                console.log("MainPage: Received button state:", data);
                setButtonState(data);
                setActiveMatchId(data.matchId); // Sync activeMatchId state
            } else if (response.status === 401) {
                console.error('MainPage: Unauthorized fetching button state.');
                setButtonState({ button_display: 'Login Required', active: false, matchId: null });
                // router.push('/'); // Redirect on auth error
            } else {
                console.error('MainPage: Error fetching button state status:', response.statusText);
                setButtonState({ button_display: 'Error Loading', active: false, matchId: null });
            }
        } catch (error) {
            console.error('MainPage: Failed to fetch button state (catch block):', error);
            setButtonState({ button_display: 'Error Loading', active: false, matchId: null });
        } finally {
            setIsLoadingButtonState(false);
        }
    };

    fetchButtonState();

    // Cleanup function for the effect (optional, if needed)
    return () => {
        // Perform cleanup if necessary, e.g., abort fetch requests
    };
  }, [router]); // Dependency array, re-run if router changes (might not be needed)

  // --- Persistent Main Socket Connection --- 
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) {
        console.log("MainPage: No token, cannot establish main socket connection.");
        return; // Don't connect if no token
    }

    // Disconnect existing main socket if it exists (e.g., HMR)
    if (mainSocketRef.current) {
        mainSocketRef.current.disconnect();
    }

    console.log("MainPage: Establishing persistent main socket connection...");
    const socket = io('http://localhost:3001', { 
        auth: { token },
        // No matchId needed here, just general connection
        // Consider adding reconnection options if needed
    });
    mainSocketRef.current = socket;

    socket.on('connect', () => {
        console.log('MainPage: Main socket connected. ID:', socket.id);
        setIsMainSocketConnected(true);
    });

    socket.on('disconnect', (reason: string) => {
        console.log('MainPage: Main socket disconnected. Reason:', reason);
        setIsMainSocketConnected(false);
    });

    socket.on('connect_error', (err: Error) => {
        console.error('MainPage: Main socket connection error:', err.message);
        setIsMainSocketConnected(false);
         // Handle auth errors specifically if needed
         if (err.message.includes('Authentication error')) {
             // Maybe force logout or show login required state?
             setButtonState({ button_display: 'Login Required', active: false, matchId: null });
         }
    });

    // --- Listen for match success event (Real-time update for matched user) ---
    socket.on('match-success', (data: MatchSuccessData) => {
        console.log(`MainPage: Received 'match-success' via main socket! Match ID: ${data.matchId}`);
        // Update button state immediately without calling API
        setButtonState({
            button_display: 'Go to Chat Room',
            active: true,
            matchId: data.matchId
        });
        setActiveMatchId(data.matchId);
        // Optional: Alert the user they have been matched
        // alert('You have been matched! Click \'Go to Chat Room\'.');
    });
    // ----------------------------------------------------------------------

    // TODO: Add listener for 'match-terminated' event (Phase 3)
    // socket.on('match-terminated', () => { ... fetchButtonState() ... });

    // Cleanup on component unmount
    return () => {
        console.log("MainPage: Unmounting, disconnecting main socket.");
        socket.disconnect();
        mainSocketRef.current = null;
        setIsMainSocketConnected(false);
    };
  }, []); // Run only once on mount

  const handleMatchClick = () => {
    // Prevent action if button state is loading or we are already attempting match
    if (isLoadingButtonState || isAttemptingMatch || !buttonState) return;

    // Determine action based on the button text from state
    if (buttonState.button_display === 'Go to Chat Room') {
        if (activeMatchId) { // Use the synced activeMatchId state
            console.log(`Navigating to chat room for match: ${activeMatchId}`);
            router.push(`/chat/${activeMatchId}`);
        } else {
             console.error("Button clicked for 'Go to Chat Room' but activeMatchId is null!");
             // Maybe refetch state or show an error?
        }
    } else if (buttonState.button_display === 'Start Matching') {
         // Ensure the button is actually active (redundant check due to disabled prop, but safe)
         if (!buttonState.active) {
             console.warn("Start Matching clicked but button is inactive.");
             return;
         }

        console.log(`User starting matching attempt!`);
        setIsAttemptingMatch(true);

        const token = localStorage.getItem('authToken');
        if (!token) {
            alert('Authentication token not found. Please log in again.');
            setIsAttemptingMatch(false);
            setButtonState({ button_display: 'Login Required', active: false, matchId: null });
            // router.push('/');
            return;
        }

        // Use tempSocketRef for the temporary connection
        if (tempSocketRef.current) {
            tempSocketRef.current.disconnect();
            tempSocketRef.current = null;
        }
        const tempSocket = io('http://localhost:3001', { 
            auth: { token },
            forceNew: true 
        });
        tempSocketRef.current = tempSocket;

        tempSocket.on('connect', () => {
            console.log('MainPage: Temporary socket connected for matching attempt. ID:', tempSocket.id);
            tempSocket.emit('start-matching');
        });

        tempSocket.on('match-success', (data: { matchId: string; opponentId: number }) => {
            console.log('MainPage: Match success received!', data);
            alert('Match found! Connecting to chat room...');
            setIsAttemptingMatch(false);
            tempSocketRef.current = null; 
            router.push(`/chat/${data.matchId}`);
        });

        tempSocket.on('no-opponent-available', (message: string) => {
            console.log('MainPage: No opponent available.', message);
            alert(message || 'No available users found. Please try again later.');
            setIsAttemptingMatch(false);
            tempSocketRef.current = null;
            // Re-fetch button state as we are no longer attempting match
            // fetchButtonState(); // Consider calling the fetch function again here or directly setting state
            setButtonState({ button_display: 'Start Matching', active: true, matchId: null }); // Assuming female user
        });

        tempSocket.on('matching-error', (errorMessage: string) => {
            console.error('MainPage: Matching error received:', errorMessage);
            alert(`Matching failed: ${errorMessage || 'Unknown error'}`);
            setIsAttemptingMatch(false);
            tempSocketRef.current = null;
            // Re-fetch button state on error
            // fetchButtonState(); 
            setButtonState({ button_display: 'Start Matching', active: true, matchId: null }); // Assuming female user
        });

        tempSocket.on('connect_error', (err: Error) => {
            console.error('MainPage: Temporary socket connection error:', err.message);
            alert(`Failed to connect to matching server: ${err.message}`);
            setIsAttemptingMatch(false);
            tempSocketRef.current = null;
             // Re-fetch button state on connection error
            // fetchButtonState(); 
            setButtonState({ button_display: 'Start Matching', active: true, matchId: null }); // Assuming female user
        });

        tempSocket.on('disconnect', (reason: string) => {
            console.log('MainPage: Temporary socket disconnected. Reason:', reason);
            if (isAttemptingMatch) {
               setIsAttemptingMatch(false);
               // Optionally re-fetch state if disconnect was unexpected during attempt
               // fetchButtonState();
            }
            tempSocketRef.current = null; 
        });
    } else {
        console.warn(`handleMatchClick called with unknown button display text: ${buttonState.button_display}`);
    }
  };

  // Profile button click handler
  const handleProfileClick = () => {
    router.push('/profile'); // Navigate to '/profile'
  };

  // --- Determine Button Text and Disabled state based on API response --- 
  let currentButtonText = 'Loading...';
  let isButtonDisabled = true;
  let showButton = false; // Default to false

  if (isLoadingButtonState) {
      currentButtonText = 'Loading...';
      isButtonDisabled = true;
      showButton = true; // Show loading indicator
  } else if (buttonState) {
      // Check for the specific case to hide the button: Inactive "Start Matching"
      if (buttonState.button_display === 'Start Matching' && !buttonState.active) {
          showButton = false; // Hide inactive "Start Matching" button for male users
          console.log("Hiding button: Inactive Start Matching.");
      } else {
          // Show button for all other loaded states (Go to Chat, Active Start Matching, Error states)
          showButton = true;
          currentButtonText = isAttemptingMatch ? 'Attempting Match...' : buttonState.button_display;
          // Disable based on API active state OR if currently attempting a match
          isButtonDisabled = !buttonState.active || isAttemptingMatch;
          // Ensure error states remain disabled
          if (buttonState.button_display === 'Login Required' || buttonState.button_display === 'Error Loading') {
              isButtonDisabled = true;
          }
      }
  }
  // If initial load fails before buttonState is set, showButton remains false

  // --- Add logs before returning JSX ---
  console.log("[MainPage Render] State before render:", {
      isLoadingButtonState,
      isAttemptingMatch,
      buttonState,
      activeMatchId // Log synced ID
  });

  return (
    <div className={`flex flex-col min-h-screen bg-black text-slate-100 ${inter.className}`}> {/* Black background, Inter font */}
      {/* Top Bar */}
      <div className="sticky top-0 z-10 p-4 bg-gray-950 shadow-md"> {/* Dark gray bg */}
        <div className="flex items-center justify-end">
          {/* Profile Button */}
          <button
            onClick={handleProfileClick}
            className="p-2 rounded-full hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-500" // Rounded-full, Amber focus
          >
            <UserCircleIcon className="h-6 w-6 text-gray-300" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-grow p-4 space-y-4">
        {/* Information Display */}
        <div className="bg-gray-950 p-4 rounded-2xl flex justify-between items-center"> {/* Dark gray bg, rounded-2xl */}
          <span className="text-slate-300">Online Users</span>
          <span className={`font-semibold ${montserrat.className}`}>{activeUsers.toLocaleString()}</span> {/* Montserrat font */}
        </div>
        <div className="bg-gray-950 p-4 rounded-2xl flex justify-between items-center"> {/* Dark gray bg, rounded-2xl */}
          <span className="text-slate-300">Avg Matching Time</span>
          <span className={`font-semibold ${montserrat.className}`}>{estimatedTime}</span> {/* Montserrat font */}
        </div>

        {/* Additional main content can go here */}
        {/* e.g., User cards, matching status display, etc. */}
        <div className="flex-grow flex items-center justify-center text-gray-500">
          {/* (Main content area placeholder) */}
        </div>
      </main>

      {/* Bottom Button */}
      {showButton && (
          <div className="sticky bottom-0 p-4 bg-black border-t border-gray-800">
              <button
                onClick={handleMatchClick}
                disabled={isButtonDisabled}
                className={`w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold py-3 px-4 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-amber-500 ${montserrat.className} disabled:opacity-50 disabled:cursor-not-allowed`} // Added cursor-not-allowed
              >
                {currentButtonText}
              </button>
          </div>
      )}
    </div>
  );
} 