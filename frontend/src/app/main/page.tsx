'use client';

import React, { useState, useEffect } from 'react';
import { UserCircleIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import { Montserrat, Inter } from 'next/font/google'; // Import fonts

// Initialize fonts
const montserrat = Montserrat({ subsets: ['latin'], weight: ['600', '700'] }); // Semibold/Bold weights
const inter = Inter({ subsets: ['latin'] });

export default function MainPage() {
  // Slider value: 1 ~ 100 (km) range, initial value 10km
  const [filterValue, setFilterValue] = useState(10);
  const router = useRouter();
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [isLoadingMatch, setIsLoadingMatch] = useState(true);
  console.log("MainPage: Component rendering"); // Add this log

  // Mock data
  const activeUsers = 127;
  const estimatedTime = '2-3 min';

  // --- Fetch active match on component mount ---
  useEffect(() => {
    console.log("MainPage: useEffect hook starting"); // Add this log

    const checkActiveMatch = async () => {
      setIsLoadingMatch(true);
      const token = localStorage.getItem('authToken');
      console.log("MainPage: Token retrieved:", token ? "Found" : "Not Found"); // Add this log

      if (!token) {
        console.log('MainPage: No token found, cannot check for active match.');
        setIsLoadingMatch(false);
        return;
      }

      try {
        console.log("MainPage: Fetching /api/matches/active..."); // Add this log
        const response = await fetch('http://localhost:3001/api/matches/active', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log("MainPage: API response status:", response.status); // Add this log

        if (response.ok) {
          const data = await response.json();
          setActiveMatchId(data.matchId);
          console.log('MainPage: Active match found:', data.matchId);
        } else if (response.status === 404) {
           setActiveMatchId(null);
           console.log('MainPage: No active match found.');
        } else {
           console.error('MainPage: Error checking active match status:', response.statusText);
           setActiveMatchId(null); 
        }
      } catch (error) {
        console.error('MainPage: Failed to fetch active match status (catch block):', error); // Modify existing log
        setActiveMatchId(null);
      } finally {
        setIsLoadingMatch(false);
      }
    };

    checkActiveMatch();
  }, []); // Run once on mount

  const handleMatchClick = () => {
    if (isLoadingMatch) return;

    if (activeMatchId) {
      console.log(`Navigating to chat room for match: ${activeMatchId}`);
      router.push(`/chat/${activeMatchId}`);
    } else {
      console.log(`Starting matching! Distance: ${filterValue}km`);
      router.push('/matching');
    }
  };

  // Profile button click handler
  const handleProfileClick = () => {
    router.push('/profile'); // Navigate to '/profile'
  };

  // --- Dynamic Button Text ---
   const buttonText = isLoadingMatch ? '상태 확인 중...' : activeMatchId ? '채팅방으로 가기' : '매칭 시작하기';

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

        {/* Filter Slider and Text */}
        <div className="mt-4 px-2">
           <input
             type="range"
             min="1" // Min 1km
             max="100" // Max 100km
             value={filterValue}
             onChange={(e) => setFilterValue(parseInt(e.target.value, 10))}
             className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-amber-500" // Darker track, Amber accent
             style={{ touchAction: 'none' }}
           />
           {/* Distance display text */}
           <p className="text-center text-sm text-slate-300 mt-2"> {/* Adjusted text color slightly */}
             Find matches within <span className={`font-semibold text-amber-400 ${montserrat.className}`}> {filterValue} km</span> {/* Amber accent, Montserrat font */}
           </p>
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
      <div className="sticky bottom-0 p-4 bg-black border-t border-gray-800"> {/* Black bg, adjusted border */}
        <button
          onClick={handleMatchClick}
          disabled={isLoadingMatch}
          className={`w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold py-3 px-4 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-amber-500 ${montserrat.className} disabled:opacity-50`} // Amber bg, rounded-full, Montserrat font, dark text, adjusted offset color
        >
          {buttonText}
        </button>
      </div>
    </div>
  );
} 