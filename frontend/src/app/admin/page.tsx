'use client';

import React, { useState, useEffect } from 'react';
// Import consistent icons
import { UserGroupIcon, UserPlusIcon, ClipboardDocumentListIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import { Montserrat, Inter } from 'next/font/google'; // Assuming you want these fonts here too

// Initialize fonts (optional, if layout doesn't already apply Inter)
const montserrat = Montserrat({ subsets: ['latin'], weight: ['700', '800'] });
const inter = Inter({ subsets: ['latin'] });

// Interface for the fetched recent match data from backend
interface FetchedRecentMatch {
  matchId: string;
  user1: { id: number; name: string } | null;
  user2: { id: number; name: string } | null;
  status: string; // Adjust based on actual backend status values
  createdAt: string;
}

export default function AdminDashboardPage() {
  // --- State for fetched data, loading, and errors ---
  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  const [newSignupsToday, setNewSignupsToday] = useState<number | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [errorStats, setErrorStats] = useState<string | null>(null);
  // -----------------------------------------------------

  // --- State for recent matches --- 
  const [recentMatches, setRecentMatches] = useState<FetchedRecentMatch[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(true);
  const [errorMatches, setErrorMatches] = useState<string | null>(null);
  // ---------------------------------

  // --- Fetch data on component mount --- 
  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingStats(true);
      setIsLoadingMatches(true);
      setErrorStats(null);
      setErrorMatches(null);
      const token = localStorage.getItem('authToken');

      if (!token) {
        const errorMsg = 'Authentication token not found. Please log in.';
        setErrorStats(errorMsg);
        setErrorMatches(errorMsg);
        setIsLoadingStats(false);
        setIsLoadingMatches(false);
        return;
      }

      // Fetch stats and matches concurrently
      try {
        const [statsResponse, matchesResponse] = await Promise.all([
          fetch('http://localhost:3001/api/admin/stats/dashboard', {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch('http://localhost:3001/api/admin/matches/recent?limit=5', { // Fetch 5 recent matches
            headers: { 'Authorization': `Bearer ${token}` }
          })
        ]);

        // Process stats response
        if (!statsResponse.ok) {
          let errorMsg = `Stats Error: ${statsResponse.status} ${statsResponse.statusText}`;
          try { const ed = await statsResponse.json(); errorMsg = ed.message || errorMsg; } catch {} 
          throw new Error(errorMsg);
        }
        const statsData = await statsResponse.json();
        setTotalUsers(statsData.totalUsers);
        setNewSignupsToday(statsData.newSignupsToday);

        // Process matches response
        if (!matchesResponse.ok) {
           let errorMsg = `Matches Error: ${matchesResponse.status} ${matchesResponse.statusText}`;
           try { const ed = await matchesResponse.json(); errorMsg = ed.message || errorMsg; } catch {} 
           throw new Error(errorMsg);
        }
        const matchesData = await matchesResponse.json();
        console.log('Fetched recent matches:', matchesData);
        setRecentMatches(matchesData);

      } catch (err: any) {
        console.error('Failed to fetch admin data:', err);
        // Set error for both sections if any fetch fails, or handle separately
        setErrorStats(err.message || 'Failed to load data.');
        setErrorMatches(err.message || 'Failed to load data.');
      } finally {
        setIsLoadingStats(false);
        setIsLoadingMatches(false);
      }
    };

    fetchData();
  }, []);
  // -------------------------------------

  // Base styles from complete-profile
  const cardBaseStyle = "bg-gray-950 p-6 rounded-xl shadow-lg min-h-[120px]";
  const headingStyle = "text-xl font-semibold text-slate-200 mb-4";
  const statLabelStyle = "text-sm text-slate-400 mb-1";
  const statValueStyle = "text-3xl font-bold text-amber-400"; // Use highlight color
  const listItemStyle = "p-4 flex items-center justify-between hover:bg-gray-800 transition-colors duration-150";
  const loadingPlaceholder = <span className="h-8 w-20 bg-slate-700 animate-pulse rounded"></span>;
  const errorTextStyle = "text-sm text-red-400";
  const listLoadingPlaceholder = (
    <div className="space-y-4 p-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex items-center space-x-4 animate-pulse">
          <div className="h-10 w-10 rounded-full bg-slate-700"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-slate-700 rounded w-3/4"></div>
            <div className="h-3 bg-slate-700 rounded w-1/2"></div>
          </div>
          <div className="h-5 w-16 bg-slate-700 rounded-full"></div>
        </div>
      ))}
    </div>
  );

  // Helper to format date
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString(undefined, { 
          year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' 
      });
    } catch {
      return 'Invalid Date';
    }
  };

  // Helper to determine match status display
  const getMatchStatusDisplay = (status: string) => {
    // Map backend status strings to display text and colors
    // Adjust these based on your actual backend `Match.status` values
    switch (status?.toLowerCase()) {
      case 'active': return { text: 'Active', color: 'bg-blue-500/20 text-blue-400' };
      case 'completed':
      case 'success': // Assuming success maps to completed
        return { text: 'Completed', color: 'bg-green-500/20 text-green-400' };
      case 'inactive':
      case 'failure': // Assuming failure maps to inactive or a specific failure state
        return { text: 'Inactive/Failed', color: 'bg-red-500/20 text-red-400' };
      case 'pending': return { text: 'Pending', color: 'bg-yellow-500/20 text-yellow-400' };
      case 'cancelled': return { text: 'Cancelled', color: 'bg-gray-500/20 text-gray-400' };
      default: return { text: status || 'Unknown', color: 'bg-gray-600/50 text-gray-300' };
    }
  };

  return (
    // Use Inter font if not inherited
    <main className={`p-6 md:p-10 ${inter.className}`}>
      {/* Consistent Header Style */}
      <div className="mb-10">
        <h1 className={`text-3xl font-bold text-slate-100 ${montserrat.className}`}>Admin Dashboard</h1>
        <p className="text-slate-400 mt-1">Overview of system activity.</p>
      </div>

      {/* Stats Cards - Display fetched data or loading/error states */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        {/* Total Users Card */}
        <div className={cardBaseStyle}>
          <div className="flex items-center mb-3">
            <UserGroupIcon className="h-6 w-6 text-amber-500 mr-3" />
            <h3 className={statLabelStyle}>Total Users</h3>
          </div>
          {isLoadingStats ? loadingPlaceholder :
           errorStats ? <p className={errorTextStyle}>{errorStats}</p> :
           <p className={statValueStyle}>{totalUsers?.toLocaleString() ?? 'N/A'}</p>
          }
        </div>
        {/* New Signups Today Card */}
        <div className={cardBaseStyle}>
          <div className="flex items-center mb-3">
            <UserPlusIcon className="h-6 w-6 text-amber-500 mr-3" />
            <h3 className={statLabelStyle}>New Signups (Today)</h3>
          </div>
          {isLoadingStats ? loadingPlaceholder :
           errorStats ? <p className={errorTextStyle}>{errorStats}</p> : // Show error in both cards if occurs
           <p className={statValueStyle}>+{newSignupsToday?.toLocaleString() ?? 'N/A'}</p>
          }
        </div>
      </div>

      {/* Recent Matches - Use fetched data */}
      <div>
        <div className="flex items-center mb-4">
          <ClipboardDocumentListIcon className="h-6 w-6 text-slate-300 mr-3" />
          <h2 className={headingStyle}>Recent Matches</h2>
        </div>
        <div className={`${cardBaseStyle} overflow-hidden`}>
          {isLoadingMatches ? listLoadingPlaceholder :
           errorMatches ? <p className={`p-4 ${errorTextStyle}`}>{errorMatches}</p> :
           recentMatches.length === 0 ? <p className="p-4 text-center text-slate-500">No recent match history found.</p> :
           <ul className="divide-y divide-slate-700">
             {recentMatches.map((match) => {
               const statusDisplay = getMatchStatusDisplay(match.status);
               return (
                 <li key={match.matchId} className={listItemStyle}>
                   <div className="flex items-center space-x-4">
                     {/* Placeholder icons or actual user images if available */}
                     <div className="flex -space-x-2">
                         <span className="inline-block h-10 w-10 rounded-full overflow-hidden bg-slate-700 flex items-center justify-center ring-2 ring-gray-950" title={match.user1?.name ?? 'User 1'}>
                           <UserCircleIcon className="h-full w-full text-slate-500" />
                         </span>
                          <span className="inline-block h-10 w-10 rounded-full overflow-hidden bg-slate-700 flex items-center justify-center ring-2 ring-gray-950" title={match.user2?.name ?? 'User 2'}>
                           <UserCircleIcon className="h-full w-full text-slate-500" />
                         </span>
                      </div>
                     <div>
                       <p className="font-medium text-slate-100">
                          {match.user1?.name ?? 'N/A'} & {match.user2?.name ?? 'N/A'}
                       </p>
                       <p className="text-xs text-slate-400">Matched: {formatDate(match.createdAt)}</p>
                     </div>
                   </div>
                   <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${statusDisplay.color}`}>
                     {statusDisplay.text}
                   </span>
                 </li>
               );
             })}
           </ul>
          }
        </div>
      </div>
    </main>
  );
} 