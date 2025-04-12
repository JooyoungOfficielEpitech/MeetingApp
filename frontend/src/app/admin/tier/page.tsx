'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
// Import consistent icons
import { MagnifyingGlassIcon, UserCircleIcon, ChevronLeftIcon, ChevronRightIcon, CheckIcon, XMarkIcon, ClockIcon } from '@heroicons/react/24/outline';
import { Montserrat, Inter } from 'next/font/google';

// Initialize fonts (assuming Inter is applied by layout)
const montserrat = Montserrat({ subsets: ['latin'], weight: ['600', '700', '800'] });
const inter = Inter({ subsets: ['latin'] });

// Interface for the fetched user data from backend
interface PendingUser {
  id: number;
  name: string;
  email: string;
  createdAt: string;
  profileImageUrl?: string; // Optional profile image
  // Add other fields displayed from User model if needed
}

// Reusable styles matching dashboard/links
const cardBaseStyle = "bg-gray-950 p-6 rounded-xl shadow-lg";
const headingStyle = `text-xl ${montserrat.className} font-semibold text-slate-200 mb-4`;
const buttonBaseStyle = `inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black disabled:opacity-50 disabled:cursor-not-allowed`;
const successButtonStyle = `${buttonBaseStyle} bg-green-600 hover:bg-green-700 text-white focus:ring-green-500`;
const dangerButtonStyle = `${buttonBaseStyle} bg-red-600 hover:bg-red-700 text-white focus:ring-red-500`;
const secondaryButtonStyle = `${buttonBaseStyle} bg-slate-700 hover:bg-slate-600 text-slate-100 focus:ring-amber-500`; // For pagination etc.
const inputBaseStyle = `w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm text-slate-100 placeholder-slate-400`;
const listItemStyle = "p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between hover:bg-gray-800 transition-colors duration-150 border-b border-slate-700 last:border-b-0";
const listLoadingPlaceholder = (
    <div className="space-y-4 p-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center space-x-4 animate-pulse">
          <div className="h-10 w-10 rounded-full bg-slate-700"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-slate-700 rounded w-3/4"></div>
            <div className="h-3 bg-slate-700 rounded w-1/2"></div>
          </div>
          <div className="flex space-x-2">
             <div className="h-8 w-20 bg-slate-700 rounded-md"></div>
             <div className="h-8 w-20 bg-slate-700 rounded-md"></div>
           </div>
        </div>
      ))}
    </div>
  );

// UserListItem component for Pending Users
const PendingUserListItem = ({ user, onApprove, onReject, isProcessing }: {
    user: PendingUser;
    onApprove: (userId: number) => Promise<void>;
    onReject: (userId: number) => Promise<void>;
    isProcessing: boolean; // Disable buttons during processing
}) => {
  const [imgError, setImgError] = useState(false);
  const isImageUrlValid = user.profileImageUrl && user.profileImageUrl.startsWith('http');

  const handleApproveClick = async () => {
      if (isProcessing) return;
      await onApprove(user.id);
  }
  const handleRejectClick = async () => {
      if (isProcessing) return;
      await onReject(user.id);
  }

  return (
    <li className={listItemStyle}>
      <div className="flex items-center space-x-4 mb-3 sm:mb-0 flex-1">
        <div className="flex-shrink-0 h-10 w-10 rounded-full overflow-hidden bg-slate-700 flex items-center justify-center">
          {!isImageUrlValid || imgError ? (
            <UserCircleIcon className="h-8 w-8 text-slate-500" />
          ) : (
            <Image
              src={user.profileImageUrl!}
              alt={`${user.name} profile`}
              width={40}
              height={40}
              className="object-cover w-full h-full"
              onError={() => setImgError(true)}
              priority={false}
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-slate-100 truncate" title={user.name}>{user.name}</p>
          <p className="text-sm text-slate-400 truncate" title={user.email}>{user.email}</p>
          <p className="text-xs text-slate-500 mt-0.5">Requested: {new Date(user.createdAt).toLocaleDateString()}</p>
        </div>
      </div>
      <div className="flex items-center space-x-2 flex-shrink-0">
        <button onClick={handleApproveClick} className={`${successButtonStyle} px-3 py-1.5 text-xs`} disabled={isProcessing}>
           <CheckIcon className="h-4 w-4 mr-1" /> Approve
        </button>
        <button onClick={handleRejectClick} className={`${dangerButtonStyle} px-3 py-1.5 text-xs`} disabled={isProcessing}>
           <XMarkIcon className="h-4 w-4 mr-1" /> Reject
        </button>
      </div>
    </li>
  );
};

export default function UserApprovalPage() {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessingAction, setIsProcessingAction] = useState(false); // For approve/reject loading

  const itemsPerPage = 10;

  // Fetch pending users function
  const fetchPendingUsers = useCallback(async (page: number, search: string) => {
    setIsLoading(true);
    setError(null);
    const token = localStorage.getItem('authToken');
    if (!token) {
      setError('Authentication token not found.');
      setIsLoading(false);
      return;
    }

    const params = new URLSearchParams({
      page: page.toString(),
      limit: itemsPerPage.toString(),
    });
    if (search) {
      params.set('search', search);
    }

    try {
      const response = await fetch(`http://localhost:3001/api/admin/users/pending?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) {
        let errorMsg = `Error: ${response.status} ${response.statusText}`;
        try { const ed = await response.json(); errorMsg = ed.message || errorMsg; } catch {} 
        throw new Error(errorMsg);
      }

      const data = await response.json();
      setPendingUsers(data.users || []);
      setTotalPages(data.totalPages || 1);
      setCurrentPage(data.currentPage || 1);
      setTotalCount(data.totalCount || 0);

    } catch (err: any) {
      console.error('Failed to fetch pending users:', err);
      setError(err.message || 'Failed to load users.');
      setPendingUsers([]); // Clear list on error
      setTotalPages(1);
      setCurrentPage(1);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  }, []); // No dependencies needed if itemsPerPage is constant

  // Initial fetch and fetch on page/search change
  useEffect(() => {
    fetchPendingUsers(currentPage, searchTerm);
  }, [currentPage, searchTerm, fetchPendingUsers]);

  // Handle search input change with debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      setCurrentPage(1); // Reset to page 1 on new search
      fetchPendingUsers(1, searchTerm);
    }, 500); // 500ms debounce

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm, fetchPendingUsers]);

  // Action Handlers
  const handleApprove = async (userId: number) => {
    setIsProcessingAction(true);
    setError(null);
    const token = localStorage.getItem('authToken');
    try {
      const response = await fetch(`http://localhost:3001/api/admin/users/${userId}/approve`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) {
         let errorMsg = `Approve Error: ${response.status}`; try { const ed = await response.json(); errorMsg = ed.message || errorMsg; } catch {} throw new Error(errorMsg);
      }
      // Refresh list after successful action
      fetchPendingUsers(currentPage, searchTerm);
    } catch (err: any) { setError(err.message); } finally { setIsProcessingAction(false); }
  };

  const handleReject = async (userId: number) => {
    if (!confirm('Are you sure you want to reject this user?')) return;
    setIsProcessingAction(true);
    setError(null);
    const token = localStorage.getItem('authToken');
    try {
      const response = await fetch(`http://localhost:3001/api/admin/users/${userId}/reject`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) {
        let errorMsg = `Reject Error: ${response.status}`; try { const ed = await response.json(); errorMsg = ed.message || errorMsg; } catch {} throw new Error(errorMsg);
      }
      // Refresh list after successful action
      fetchPendingUsers(currentPage, searchTerm);
    } catch (err: any) { setError(err.message); } finally { setIsProcessingAction(false); }
  };

  // Pagination Button Component
  const PaginationButton = ({ children, onClick, disabled, isActive }: { children: React.ReactNode, onClick: () => void, disabled?: boolean, isActive?: boolean }) => (
    <button onClick={onClick} disabled={disabled} className={`px-3 py-1.5 rounded-md text-sm transition-colors duration-150 ${isActive ? 'bg-amber-500 text-black cursor-default' : disabled ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-slate-700 text-slate-300 hover:bg-slate-600' }`}>
      {children}
    </button>
  );

  return (
    <main className={`p-6 md:p-10 ${inter.className}`}>
      {/* Header */}
      <div className="mb-10">
        <h1 className={`text-3xl font-bold text-slate-100 ${montserrat.className}`}>New User Approval</h1>
        <p className="text-slate-400 mt-1">Review and approve or reject new user sign-ups.</p>
      </div>

      {/* Search and Stats */}
      <div className={`${cardBaseStyle} mb-8 flex flex-col md:flex-row justify-between items-center gap-4`}>
         <div className="relative w-full md:w-1/2 lg:w-1/3">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`${inputBaseStyle} pl-9`}
              disabled={isLoading}
            />
          </div>
          <div className="text-right">
             <p className="text-sm text-slate-400">Pending Users</p>
             <p className={`text-2xl font-bold text-amber-400 ${montserrat.className}`}>{isLoading ? '...' : totalCount.toLocaleString()}</p>
           </div>
      </div>

        {/* Error Display */}
        {error && <p className="text-red-400 text-center mb-4 text-sm">Error: {error}</p>}

      {/* User List */} 
      <div className={`${cardBaseStyle} overflow-x-auto`}> 
         <h2 className={`${headingStyle} mb-1`}>Pending Approval List</h2>
         {isLoading ? listLoadingPlaceholder :
           pendingUsers.length === 0 ? <p className="text-slate-500 text-center py-10">No users pending approval found.</p> :
           <ul> {/* Removed min-width and divide-y for this style */}
              {pendingUsers.map((user) => (
                <PendingUserListItem 
                    key={user.id} 
                    user={user} 
                    onApprove={handleApprove} 
                    onReject={handleReject} 
                    isProcessing={isProcessingAction}
                />
              ))}
            </ul>
         }
      </div>

      {/* Pagination Controls */}
      {!isLoading && totalPages > 1 && (
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
           <p className="text-sm text-slate-400">
              Page {currentPage} of {totalPages} ({totalCount} users total)
           </p>
          <div className="flex items-center space-x-1.5">
            <PaginationButton onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1 || isProcessingAction}>
              <ChevronLeftIcon className="h-4 w-4" />
            </PaginationButton>
            {/* Simplified pagination display - potentially show more pages */} 
            <span className="text-sm px-2">{currentPage}</span> 
            <PaginationButton onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || isProcessingAction}>
              <ChevronRightIcon className="h-4 w-4" />
            </PaginationButton>
          </div>
        </div>
      )}
    </main>
  );
} 