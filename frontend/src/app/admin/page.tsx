'use client';

import React from 'react';
import { UserCircleIcon } from '@heroicons/react/24/outline';

// Mock data type definitions
interface DashboardStats {
  activeUsers: number;
  newSignups: number;
}

interface RecentMatch {
  id: number;
  userName: string;
  userTier: number;
  status: 'success' | 'failure';
}

export default function AdminDashboardPage() {
  // Mock data
  const stats: DashboardStats = {
    activeUsers: 2847,
    newSignups: 124,
  };

  const recentMatches: RecentMatch[] = [
    { id: 1, userName: 'Minjun Kim', userTier: 1, status: 'success' },
    { id: 2, userName: 'Seoyeon Lee', userTier: 3, status: 'failure' },
    // Additional recent match data...
  ];

  return (
    <main className="p-6 md:p-10">
      <h1 className="text-2xl md:text-3xl font-bold mb-2">Dashboard</h1>
      <p className="text-gray-400 mb-8">Today's Overview</p>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10">
        <div className="bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-gray-400 text-sm mb-1">Active Users</h3>
          <p className="text-3xl font-semibold">{stats.activeUsers.toLocaleString()}</p>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-gray-400 text-sm mb-1">New Signups</h3>
          <p className="text-3xl font-semibold">+{stats.newSignups.toLocaleString()}</p>
        </div>
      </div>

      {/* Recent Matches */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Recent Matches</h2>
        <div className="bg-gray-800 rounded-lg shadow overflow-hidden">
          <ul className="divide-y divide-gray-700">
            {recentMatches.map((match) => (
              <li key={match.id} className="p-4 flex items-center justify-between hover:bg-gray-700/50">
                <div className="flex items-center space-x-3">
                   {/* Placeholder user icon */}
                   <span className="inline-block h-10 w-10 rounded-full overflow-hidden bg-gray-600">
                     <UserCircleIcon className="h-full w-full text-gray-400" />
                   </span>
                  <div>
                    <p className="font-medium">{match.userName}</p>
                    <p className="text-xs text-gray-400">Tier {match.userTier}</p>
                  </div>
                </div>
                <span className={`text-sm font-medium px-2 py-1 rounded-full ${
                  match.status === 'success' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
                }`}>
                  {match.status === 'success' ? 'Success' : 'Failure'}
                </span>
              </li>
            ))}
            {recentMatches.length === 0 && (
              <li className="p-4 text-center text-gray-500">No recent match history.</li>
            )}
          </ul>
        </div>
      </div>
    </main>
  );
} 