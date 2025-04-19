'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link'; // Import Link for navigation
// Import consistent icons
import { UserGroupIcon, ClipboardDocumentListIcon, ChartBarIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import { Montserrat, Inter } from 'next/font/google'; // Assuming you want these fonts here too
import axiosInstance from '@/utils/axiosInstance'; // Import axios instance
// Removed unused icons: UserPlusIcon, UserCircleIcon, CheckCircleIcon, XCircleIcon, TrashIcon, ArrowPathIcon

// Initialize fonts (optional, if layout doesn't already apply Inter)
const montserrat = Montserrat({ subsets: ['latin'], weight: ['700', '800'] });
const inter = Inter({ subsets: ['latin'] });

// Interface for the fetched recent match data from backend
interface FetchedRecentMatch {
  matchId: string;
  user1: { id: number; name: string; nickname?: string | null; gender: string | null; } | null;
  user2: { id: number; name: string; nickname?: string | null; gender: string | null; } | null;
  status: string;
  createdAt: string;
}

// ★ Interface for the dashboard stats API response ★
interface DashboardStatsResponse {
  totalUsers: number;
  newSignupsToday: number;
  pendingApprovalCount: number;
}

// Removed User and FetchUsersResponse interfaces as they are no longer needed here

export default function AdminDashboardPage() {
  // --- State for fetched data, loading, and errors ---
  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  const [newSignupsToday, setNewSignupsToday] = useState<number | null>(null);
  const [pendingApprovalCount, setPendingApprovalCount] = useState<number | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [errorStats, setErrorStats] = useState<string | null>(null);
  // -----------------------------------------------------

  // --- State for recent matches --- 
  const [recentMatches, setRecentMatches] = useState<FetchedRecentMatch[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(true);
  const [errorMatches, setErrorMatches] = useState<string | null>(null);
  // ---------------------------------

  // Removed User Management state variables

  // --- Fetch data on component mount --- 
  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingStats(true);
      setIsLoadingMatches(true);
      setErrorStats(null);
      setErrorMatches(null);
      const token = localStorage.getItem('token');

      if (!token) {
        const errorMsg = 'Authentication token not found. Please log in.';
        setErrorStats(errorMsg);
        setErrorMatches(errorMsg);
        setIsLoadingStats(false);
        setIsLoadingMatches(false);
        // Consider redirecting to login page
        return;
      }

      // Fetch stats and matches concurrently
      try {
        // ★ Use axiosInstance with explicit response types ★
        const [statsResponse, matchesResponse] = await Promise.all([
          axiosInstance.get<DashboardStatsResponse>('/api/admin/stats/dashboard'),
          axiosInstance.get<FetchedRecentMatch[]>('/api/admin/matches/recent?limit=5') // Fetch 5 recent matches
        ]);

        // ★ Access data using response.data ★
        setTotalUsers(statsResponse.data.totalUsers);
        setNewSignupsToday(statsResponse.data.newSignupsToday);
        setPendingApprovalCount(statsResponse.data.pendingApprovalCount); // Assuming backend provides this

        // Process matches response
        console.log('Fetched recent matches:', matchesResponse.data);
        setRecentMatches(matchesResponse.data);

      } catch (err: any) {
        console.error('Failed to fetch admin data:', err);
        const errorMsg = err.response?.data?.message || err.message || 'Failed to load dashboard data.';
        // Set error for both sections if any fetch fails, or handle separately
        setErrorStats(errorMsg);
        setErrorMatches(errorMsg);
      } finally {
        setIsLoadingStats(false);
        setIsLoadingMatches(false);
      }
    };

    fetchData();

    // Removed fetchUsers() call
  }, []);
  // -------------------------------------

  // Removed fetchUsers function
  // Removed handleApprove, handleReject, handleForceDelete functions

  // Base styles (simplified)
  const cardBaseStyle = "bg-gray-950 p-6 rounded-xl shadow-lg"; // Removed min-height
  const headingStyle = "text-xl font-semibold text-slate-200 mb-4";
  const statLabelStyle = "text-sm text-slate-400 mb-1";
  const statValueStyle = "text-3xl font-bold text-amber-400";
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

  // Helper to format date (keep)
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString(undefined, { 
          year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' 
      });
    } catch {
      return 'Invalid Date';
    }
  };

  // Helper to determine match status display (keep)
  const getMatchStatusDisplay = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case 'active': return { text: 'Active', color: 'bg-blue-500/20 text-blue-400' };
      case 'completed':
      case 'success': 
        return { text: 'Completed', color: 'bg-green-500/20 text-green-400' };
      case 'inactive':
      case 'failure': 
        return { text: 'Inactive/Failed', color: 'bg-red-500/20 text-red-400' };
      case 'pending': return { text: 'Pending', color: 'bg-yellow-500/20 text-yellow-400' };
      case 'cancelled': return { text: 'Cancelled', color: 'bg-gray-500/20 text-gray-400' };
      default: return { text: status || 'Unknown', color: 'bg-gray-600/50 text-gray-300' };
    }
  };

  // ★ Helper function to get gender-based color class ★
  const getNameColorClass = (gender: string | null): string => {
    if (gender === 'male') {
      return 'text-blue-400'; // Blue for male
    } else if (gender === 'female') {
      return 'text-red-400'; // Red for female
    } else {
      return 'text-slate-200'; // Default color
    }
  };

  return (
    <div className={`p-6 md:p-10 bg-gray-900 min-h-screen text-slate-100 ${inter.className}`}>
      <h1 className={`text-3xl font-bold text-slate-100 mb-8 ${montserrat.className}`}>Admin Dashboard</h1>

      {/* Dashboard Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Total Users Card */}
        <div className={cardBaseStyle}>
          <h2 className={headingStyle}>
            <UserGroupIcon className="h-6 w-6 inline mr-2 align-text-bottom text-amber-400"/> Total Users
          </h2>
          {isLoadingStats ? loadingPlaceholder : errorStats ? <p className={errorTextStyle}>{errorStats}</p> : 
            <p className={statValueStyle}>{totalUsers ?? 'N/A'}</p>
          }
          <p className={statLabelStyle}>All registered users</p>
        </div>

        {/* New Signups Today Card */}
        <div className={cardBaseStyle}>
          <h2 className={headingStyle}>
             <ChartBarIcon className="h-6 w-6 inline mr-2 align-text-bottom text-amber-400"/> New Signups (Today)
          </h2>
          {isLoadingStats ? loadingPlaceholder : errorStats ? <p className={errorTextStyle}>{errorStats}</p> : 
             <p className={statValueStyle}>{newSignupsToday ?? 'N/A'}</p>
          }
           <p className={statLabelStyle}>Users registered today</p>
        </div>

        {/* Pending Approvals Card & Link */}
        <div className={`${cardBaseStyle} flex flex-col justify-between`}> 
          <div>
            <h2 className={headingStyle}>
              <ClipboardDocumentListIcon className="h-6 w-6 inline mr-2 align-text-bottom text-amber-400"/> Pending Approval
            </h2>
            {isLoadingStats ? loadingPlaceholder : errorStats ? <p className={errorTextStyle}>{errorStats}</p> : 
              <p className={statValueStyle}>{pendingApprovalCount ?? 'N/A'}</p>
            }
            <p className={statLabelStyle}>Users awaiting review</p>
          </div>
          <Link href="/admin/tier" className="mt-4 inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-black bg-amber-500 rounded-md hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-950 focus:ring-amber-500">
             Manage Approvals <ArrowRightIcon className="h-4 w-4 ml-2"/>
          </Link>
        </div>
      </div>

      {/* Recent Matches - Updated to show gender colors and link to chat history */}
      <div className={`${cardBaseStyle} mb-8`}>
          <h2 className={headingStyle}>Recent Match Activity</h2>
          {isLoadingMatches ? listLoadingPlaceholder : errorMatches ? <p className={errorTextStyle}>{errorMatches}</p> : (
            <ul className="divide-y divide-gray-700">
              {recentMatches.length > 0 ? (
                recentMatches.map((match) => (
                  <Link key={match.matchId} href={`/admin/chat/${match.matchId}`} className="block hover:bg-gray-800 transition-colors duration-150">
                    <li className={`${listItemStyle} border-0`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-200 truncate">
                          <span className={getNameColorClass(match.user1 ? match.user1.gender : null)}>
                            {match.user1?.nickname || match.user1?.name || 'N/A'}
                          </span>
                          <span> & </span> 
                          <span className={getNameColorClass(match.user2 ? match.user2.gender : null)}>
                            {match.user2?.nickname || match.user2?.name || 'N/A'}
                          </span>
                        </p>
                        <p className="text-xs text-slate-400 truncate">ID: {match.matchId}</p>
                      </div>
                      <div className="ml-4 flex-shrink-0 flex flex-col items-end">
                        <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${getMatchStatusDisplay(match.status).color}`}>
                          {getMatchStatusDisplay(match.status).text}
                        </span>
                        <p className="text-xs text-slate-500 mt-1">{formatDate(match.createdAt)}</p>
                      </div>
                    </li>
                  </Link>
                ))
              ) : (
                <p className="text-center text-slate-400 py-4">No recent match activity.</p>
              )}
            </ul>
          )}
        </div>
      
      {/* Removed User Management Table Section */}

    </div>
  );
} 