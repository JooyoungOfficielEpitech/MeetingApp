'use client';

import React, { useState } from 'react';
// Import consistent icons
import { FunnelIcon, MagnifyingGlassIcon, ClipboardDocumentIcon, TrashIcon, PlusCircleIcon, LinkIcon, ClockIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { Montserrat, Inter } from 'next/font/google'; // Import fonts

// Initialize fonts (assuming Inter is applied by layout)
const montserrat = Montserrat({ subsets: ['latin'], weight: ['600', '700', '800'] });
const inter = Inter({ subsets: ['latin'] }); // Keep if needed locally

// Mock data type definitions (keep as is or fetch real data)
interface LinkStats {
  total: number;
  active: number;
  totalUsage: number;
  monthlyUsage: number;
}

interface ActiveLink {
  id: string;
  name: string;
  createdAt: string;
  status: 'active' | 'inactive';
  usedCount: number;
  limit: number;
}

interface UsageHistory {
  id: number;
  userName: string;
  linkName: string;
  ipAddress: string;
  usedAt: string;
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
    { id: 'link1abc', name: 'Admin Invite', createdAt: '2024.02.15', status: 'active', usedCount: 8, limit: 10 },
    { id: 'link2def', name: 'General Member Invite', createdAt: '2024.02.14', status: 'active', usedCount: 15, limit: 20 },
    { id: 'link3ghi', name: 'Expired Test Link', createdAt: '2024.01.10', status: 'inactive', usedCount: 5, limit: 5 },
  ];

  const usageHistory: UsageHistory[] = [
    { id: 1, userName: 'Jiwon Kim', linkName: 'Admin Invite', ipAddress: '192.168.1.100', usedAt: '2024.02.15 14:30' },
    { id: 2, userName: 'Seoyeon Park', linkName: 'General Member Invite', ipAddress: '192.168.1.101', usedAt: '2024.02.15 11:20' },
    { id: 3, userName: 'Minsu Lee', linkName: 'General Member Invite', ipAddress: '192.168.1.102', usedAt: '2024.02.14 16:45' },
  ];

  // State for potential future features like search/filter
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // e.g., 'all', 'active', 'inactive'

  // TODO: Implement filtering/searching based on state

  const handleCreateLink = () => {
    alert('Create new invite link functionality (pending implementation)');
  };

  const handleCopyLink = (linkId: string) => {
    const fullLink = `https://yourapp.com/invite/${linkId}`; // Update with actual link
    navigator.clipboard.writeText(fullLink)
      .then(() => alert('Invite link copied: ' + fullLink))
      .catch(err => alert('Failed to copy link.'));
  };

  const handleDeleteLink = (linkId: string) => {
    const linkName = activeLinks.find(l => l.id === linkId)?.name;
    if (confirm(`Are you sure you want to delete the link \'${linkName}\'?`)) {
      alert(`Delete link functionality for ID ${linkId} (pending implementation)`);
      // API call and state update needed here
    }
  };

  // Reusable styles matching dashboard
  const cardBaseStyle = "bg-gray-950 p-6 rounded-xl shadow-lg";
  const headingStyle = `text-xl ${montserrat.className} font-semibold text-slate-200 mb-4`;
  const subHeadingStyle = `text-lg ${montserrat.className} font-semibold text-slate-300`;
  const buttonBaseStyle = `inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black`;
  const primaryButtonStyle = `${buttonBaseStyle} bg-amber-500 hover:bg-amber-600 text-black`;
  const secondaryButtonStyle = `${buttonBaseStyle} bg-slate-700 hover:bg-slate-600 text-slate-100`;
  const iconButtonStyle = `p-2 rounded-lg text-slate-400 hover:bg-slate-700 hover:text-slate-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-amber-500`;
  const listItemStyle = "p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between hover:bg-gray-800 transition-colors duration-150";

  // Stat Card Component (updated style)
  const StatCard = ({ title, value }: { title: string, value: string | number }) => (
    <div className={cardBaseStyle}>
      <h3 className="text-sm text-slate-400 mb-1">{title}</h3>
      <p className={`text-3xl font-bold text-amber-400 ${montserrat.className}`}>{typeof value === 'number' ? value.toLocaleString() : value}</p>
    </div>
  );

  return (
    // Use Inter font (likely inherited from layout)
    <main className={`p-6 md:p-10 ${inter.className}`}>
      {/* Consistent Header Style */}
      <div className="mb-10">
        <h1 className={`text-3xl font-bold text-slate-100 ${montserrat.className}`}>Invite Link Management</h1>
        <p className="text-slate-400 mt-1">Create, monitor, and manage invite links.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-10">
        <StatCard title="Total Links" value={stats.total} />
        <StatCard title="Active Links" value={stats.active} />
        <StatCard title="Total Uses" value={stats.totalUsage} />
        <StatCard title="Uses This Month" value={stats.monthlyUsage} />
      </div>

      {/* Actions: Create Link and Filter/Search */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8">
        <button onClick={handleCreateLink} className={`${primaryButtonStyle}`}> 
          <PlusCircleIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
          Create New Link
        </button>
        {/* Add Filter/Search controls here if needed */}
        <div className="flex items-center space-x-2">
            {/* Example Search Input - needs state/handler */}
            {/* <div className="relative">
                <input type="text" placeholder="Search links..." className="bg-slate-800 border border-slate-700 rounded-md pl-10 pr-4 py-2 text-sm focus:ring-amber-500 focus:border-amber-500" />
                <MagnifyingGlassIcon className="h-5 w-5 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            </div> */}
            {/* Example Filter Dropdown - needs state/handler */}
             {/* <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm focus:ring-amber-500 focus:border-amber-500">
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
             </select> */}
        </div>
      </div>

      {/* Active Invite Links Table/List */}
      <div className={`${cardBaseStyle} mb-10`}> 
        <h2 className={`${headingStyle} mb-5`}>Active Links</h2>
        <div className="space-y-4">
          {activeLinks.map(link => (
            <div key={link.id} className={`${listItemStyle} border-b border-slate-700 last:border-b-0`}>
              <div className="flex-1 mb-3 sm:mb-0 pr-4">
                <h3 className={`${subHeadingStyle}`}>{link.name}</h3>
                <div className="flex items-center space-x-3 text-xs text-slate-400 mt-1">
                    <LinkIcon className="h-4 w-4" /> <span>ID: {link.id}</span>
                    <ClockIcon className="h-4 w-4" /> <span>Created: {link.createdAt}</span>
                </div>
                <div className="mt-2 flex items-center space-x-2">
                   <span className={`inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full ${link.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-slate-600/50 text-slate-400'}`}>
                      {link.status === 'active' ? <CheckCircleIcon className="h-3 w-3 mr-1"/> : <XCircleIcon className="h-3 w-3 mr-1"/>}
                      {link.status === 'active' ? 'Active' : 'Inactive'}
                   </span>
                   <span className="text-xs text-slate-400">({link.usedCount}/{link.limit} uses)</span>
                </div>
              </div>
              <div className="flex items-center space-x-2 flex-shrink-0">
                <button onClick={() => handleCopyLink(link.id)} className={iconButtonStyle} title="Copy Link">
                  <ClipboardDocumentIcon className="h-5 w-5" />
                </button>
                <button onClick={() => handleDeleteLink(link.id)} className={`${iconButtonStyle} hover:text-red-400`} title="Delete Link">
                  <TrashIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          ))}
          {activeLinks.length === 0 && <p className="text-slate-500 text-center py-6">No active invite links found.</p>}
        </div>
      </div>

      {/* Usage History Table/List */}
      <div className={cardBaseStyle}>
        <h2 className={`${headingStyle} mb-5`}>Usage History (Recent)</h2>
        <div className="space-y-3">
          {usageHistory.slice(0, 5).map(history => ( // Show more recent history
            <div key={history.id} className={`${listItemStyle} border-b border-slate-700 last:border-b-0`}>
              <div className="flex-1 pr-4">
                <p className="font-medium text-slate-100">{history.userName}</p>
                <p className="text-sm text-slate-400">Used: {history.linkName}</p>
                <p className="text-xs text-slate-500 mt-1">IP: {history.ipAddress}</p>
              </div>
              <span className="text-xs text-slate-400 flex-shrink-0">{history.usedAt}</span>
            </div>
          ))}
          {usageHistory.length === 0 && <p className="text-slate-500 text-center py-6">No usage history found.</p>}
          {usageHistory.length > 5 && (
             <div className="text-center pt-4">
                 <a href="#" className="text-sm text-amber-400 hover:text-amber-300">View All History</a>
             </div>
          )}
        </div>
      </div>
    </main>
  );
} 