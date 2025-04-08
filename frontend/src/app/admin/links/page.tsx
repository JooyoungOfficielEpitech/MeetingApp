'use client';

import React, { useState } from 'react';
import { FunnelIcon, MagnifyingGlassIcon, ClipboardDocumentIcon, TrashIcon } from '@heroicons/react/24/outline';

// Mock data type definitions
interface LinkStats {
  total: number;
  active: number;
  totalUsage: number;
  monthlyUsage: number;
}

interface ActiveLink {
  id: string; // Changed ID type to string (considering usage like copying)
  name: string;
  createdAt: string; // Example: '2024.02.15'
  status: 'active' | 'inactive'; // Example: Active, Inactive
  usedCount: number;
  limit: number;
}

interface UsageHistory {
  id: number;
  userName: string;
  linkName: string; // Which link was used
  ipAddress: string;
  usedAt: string; // Example: '2024.02.15 14:30'
}

export default function LinkManagementPage() {
  // Mock data
  const stats: LinkStats = {
    total: 24,
    active: 12,
    totalUsage: 156,
    monthlyUsage: 34,
  };

  const activeLinks: ActiveLink[] = [
    { id: 'link1abc', name: 'Admin Invite', createdAt: '2024.02.15', status: 'active', usedCount: 8, limit: 10 }, // Translated name
    { id: 'link2def', name: 'General Member Invite', createdAt: '2024.02.14', status: 'active', usedCount: 15, limit: 20 }, // Translated name
    // Additional active link data...
  ];

  const usageHistory: UsageHistory[] = [
    { id: 1, userName: 'Jiwon Kim', linkName: 'Admin Invite', ipAddress: '192.168.1.100', usedAt: '2024.02.15 14:30' }, // Translated names
    { id: 2, userName: 'Seoyeon Park', linkName: 'General Member Invite', ipAddress: '192.168.1.101', usedAt: '2024.02.15 11:20' }, // Translated names
    { id: 3, userName: 'Minsu Lee', linkName: 'General Member Invite', ipAddress: '192.168.1.102', usedAt: '2024.02.14 16:45' }, // Translated names
    // Additional usage history data...
  ];

  const handleCreateLink = () => {
    // TODO: Implement create new invite link logic
    alert('Create new invite link functionality (pending implementation)'); // Translated
  };

  const handleCopyLink = (linkId: string) => {
    // TODO: Implement link copy logic (navigator.clipboard)
    navigator.clipboard.writeText(`https://yourapp.com/invite/${linkId}`) // Needs update with actual link format
      .then(() => alert('Invite link copied to clipboard.')) // Translated
      .catch(err => alert('Failed to copy link.')); // Translated
  };

  const handleDeleteLink = (linkId: string) => {
    // TODO: Implement link deletion logic (requires state update)
    const linkName = activeLinks.find(l => l.id === linkId)?.name;
    if (confirm(`Are you sure you want to delete the link \'${linkName}\'?`)) { // Translated
        alert(`Delete link functionality for ID ${linkId} (pending implementation)`); // Translated
        // In actual implementation: API call and state update
    }
  };

   const StatCard = ({ title, value }: { title: string, value: string | number }) => (
    <div className="bg-gray-800 p-6 rounded-lg shadow">
      <h3 className="text-gray-400 text-sm mb-1">{title}</h3>
      <p className="text-3xl font-semibold">{typeof value === 'number' ? value.toLocaleString() : value}</p>
    </div>
  );

  return (
    <main className="p-6 md:p-10">
      <h1 className="text-2xl md:text-3xl font-bold mb-8">Invite Link Management</h1> {/* Translated */}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
         <StatCard title="Total Links" value={stats.total} /> {/* Translated */}
         <StatCard title="Active Links" value={stats.active} /> {/* Translated */}
         <StatCard title="Total Uses" value={stats.totalUsage} /> {/* Translated */}
         <StatCard title="Uses This Month" value={stats.monthlyUsage} /> {/* Translated */}
      </div>

      {/* Create New Link Button */}
      <div className="mb-10">
         <button
           onClick={handleCreateLink}
           className="w-full bg-black hover:bg-gray-950 text-white font-semibold py-3 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500"
         >
            Create New Invite Link {/* Translated */}
         </button>
      </div>

      {/* Active Invite Links */}
      <div className="mb-10">
         <div className="flex justify-between items-center mb-4">
           <h2 className="text-xl font-semibold">Active Invite Links</h2> {/* Translated */}
           <div className="flex space-x-2">
              <button className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 focus:outline-none" title="Filter">
                 <FunnelIcon className="h-5 w-5" />
              </button>
               <button className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 focus:outline-none" title="Search">
                 <MagnifyingGlassIcon className="h-5 w-5" />
               </button>
           </div>
         </div>
         <div className="space-y-4">
           {activeLinks.map(link => (
             <div key={link.id} className="bg-gray-800 p-4 rounded-lg shadow flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div className="mb-3 sm:mb-0">
                  <h3 className="font-medium">{link.name}</h3>
                  <p className="text-xs text-gray-400">Created {link.createdAt}</p> {/* Translated */}
                  <span className={`mt-1 inline-block text-xs font-medium px-2 py-0.5 rounded-full ${link.status === 'active' ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-400'}`}>
                     {link.status === 'active' ? 'Active' : 'Inactive'} {/* Translated */}
                  </span>
                </div>
                <div className="flex items-center justify-between sm:justify-end space-x-2">
                   <span className="text-sm text-gray-400">Uses left: {link.usedCount}/{link.limit}</span> {/* Translated */}
                   <button onClick={() => handleCopyLink(link.id)} className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 focus:outline-none" title="Copy">
                      <ClipboardDocumentIcon className="h-5 w-5" />
                   </button>
                   <button onClick={() => handleDeleteLink(link.id)} className="p-2 rounded-lg bg-gray-700 hover:bg-red-600 text-gray-300 hover:text-white focus:outline-none" title="Delete">
                      <TrashIcon className="h-5 w-5" />
                   </button>
                </div>
             </div>
           ))}
            {activeLinks.length === 0 && <p className="text-gray-500 text-center py-4">No active invite links found.</p>} {/* Translated */}
         </div>
      </div>

      {/* Usage History */} 
      <div>
         <div className="flex justify-between items-center mb-4">
           <h2 className="text-xl font-semibold">Usage History</h2> {/* Translated */}
           <a href="#" className="text-sm text-indigo-400 hover:text-indigo-300">View All</a> {/* Translated */}
         </div>
          <div className="space-y-3">
            {usageHistory.slice(0, 3).map(history => ( // Show only recent 3
               <div key={history.id} className="bg-gray-800 p-4 rounded-lg shadow flex justify-between items-start">
                 <div>
                   <p className="font-medium">{history.userName}</p>
                   <p className="text-sm text-gray-400">{history.linkName}</p>
                   <p className="text-xs text-gray-500 mt-1">IP: {history.ipAddress}</p>
                 </div>
                  <span className="text-xs text-gray-400 flex-shrink-0 ml-4">{history.usedAt}</span>
               </div>
            ))}
             {usageHistory.length === 0 && <p className="text-gray-500 text-center py-4">No usage history found.</p>} {/* Translated */}
          </div>
      </div>

    </main>
  );
} 