'use client';

import React, { useState } from 'react';
import Image from 'next/image'; // For user image display
import { MagnifyingGlassIcon, ChevronDownIcon, UserCircleIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

// Mock user data type
interface TierUser {
  id: number;
  name: string;
  joinDate: string; // Example: '2024.01.15'
  profileImageUrl: string; // Using placeholder
  tierStatus: 'completed' | 'pending'; // Tier status: Completed, Pending
}

// Mock stats data type
interface TierStats {
  completed: number;
  pending: number;
}

// UserListItem component definition
const UserListItem = ({ user, onEditClick }: { user: TierUser, onEditClick: (userId: number) => void }) => {
  const [imgError, setImgError] = useState(false); // Image error state

  return (
    <li className="p-4 flex items-center justify-between hover:bg-gray-700/50">
      <div className="flex items-center space-x-4">
         {/* User image - with error handling */}
         <div className="flex-shrink-0 h-12 w-12 rounded-full overflow-hidden bg-gray-600 flex items-center justify-center">
           {imgError ? (
             // Show UserCircleIcon on error
             <UserCircleIcon className="h-10 w-10 text-gray-400" />
           ) : (
             // Use Image component on successful load
             <Image
               src={user.profileImageUrl}
               alt={`${user.name} profile`}
               width={48}
               height={48}
               className="object-cover w-full h-full"
               onError={() => setImgError(true)} // Change state on error
               priority={false} // Lower priority for list images (optional)
             />
           )}
         </div>
        <div>
          <p className="font-medium">{user.name}</p>
          <p className="text-xs text-gray-400">Joined {user.joinDate}</p>
        </div>
      </div>
      <div className="flex items-center space-x-4">
         {/* Tier status */}
         <span className={`text-sm font-medium px-3 py-1 rounded-full ${
           user.tierStatus === 'completed' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
         }`}>
           {user.tierStatus === 'completed' ? 'Completed' : 'Pending'}
         </span>
         {/* Edit Tier button */}
         <button
           onClick={() => onEditClick(user.id)}
           className="bg-black hover:bg-gray-950 text-white text-sm font-semibold py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500"
         >
            Edit Tier
         </button>
      </div>
    </li>
  );
};

export default function TierManagementPage() {
  const [activeTab, setActiveTab] = useState<'all' | 'completed' | 'pending'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('latest'); // Example: 'latest', 'oldest'
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10; // Items per page

  // Mock data
  const stats: TierStats = {
    completed: 324,
    pending: 156,
  };

  // Mock user data (keeping Korean names for example)
  const allUsers: TierUser[] = [
    { id: 1, name: '김지현', joinDate: '2024.01.15', profileImageUrl: 'https://via.placeholder.com/100/8A2BE2/FFFFFF?text=KH', tierStatus: 'completed' },
    { id: 2, name: '박민수', joinDate: '2024.01.14', profileImageUrl: 'https://via.placeholder.com/100/4682B4/FFFFFF?text=PM', tierStatus: 'pending' },
    { id: 3, name: '이서연', joinDate: '2024.01.13', profileImageUrl: 'https://via.placeholder.com/100/CD5C5C/FFFFFF?text=LS', tierStatus: 'completed' },
    { id: 4, name: '최우진', joinDate: '2024.01.12', profileImageUrl: 'https://via.placeholder.com/100/FFBF00/FFFFFF?text=CW', tierStatus: 'pending' },
    { id: 5, name: '정하윤', joinDate: '2024.01.11', profileImageUrl: 'https://via.placeholder.com/100/DE3163/FFFFFF?text=JH', tierStatus: 'completed' },
    { id: 6, name: '에러테스트', joinDate: '2024.01.10', profileImageUrl: '', tierStatus: 'pending' },
  ];

  // Filtering and Sorting Logic (Mock)
  const filteredUsers = allUsers
    .filter(user => {
      if (activeTab === 'completed') return user.tierStatus === 'completed';
      if (activeTab === 'pending') return user.tierStatus === 'pending';
      return true; // 'all'
    })
    .filter(user => user.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
       // Sorting logic (simple example by join date here)
       if (sortOrder === 'latest') {
           return new Date(b.joinDate.replace(/\./g, '-')).getTime() - new Date(a.joinDate.replace(/\./g, '-')).getTime();
       } else if (sortOrder === 'oldest') {
            return new Date(a.joinDate.replace(/\./g, '-')).getTime() - new Date(b.joinDate.replace(/\./g, '-')).getTime();
       }
       return 0;
    });

   // Pagination Logic
   const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
   const paginatedUsers = filteredUsers.slice(
       (currentPage - 1) * itemsPerPage,
       currentPage * itemsPerPage
   );

  const handleTierEdit = (userId: number) => {
    // TODO: Implement tier editing logic (e.g., open a modal)
    alert(`Edit Tier functionality for user ID ${userId} (pending implementation)`);
  };

  const TabButton = ({ label, value, current, onClick }: { label: string, value: string, current: string, onClick: (value: string) => void }) => (
    <button
      onClick={() => onClick(value)}
      className={`px-4 py-2 rounded-lg text-sm font-medium ${
        current === value ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
      }`}
    >
      {label}
    </button>
  );

  const PaginationButton = ({ children, onClick, disabled, className: extraClassName }: { children: React.ReactNode, onClick: () => void, disabled?: boolean, className?: string }) => (
     <button
        onClick={onClick}
        disabled={disabled}
        className={`px-3 py-2 rounded-lg text-sm ${ 
            disabled ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
        } ${extraClassName || ''}`}
     >
        {children}
     </button>
  );

  return (
    <main className="p-6 md:p-10">
      <h1 className="text-2xl md:text-3xl font-bold mb-6">Tier Management</h1>

      {/* Tabs */}
      <div className="flex space-x-3 mb-6">
        <TabButton label="All" value="all" current={activeTab} onClick={() => { setActiveTab('all'); setCurrentPage(1); }} />
        <TabButton label="Completed" value="completed" current={activeTab} onClick={() => { setActiveTab('completed'); setCurrentPage(1); }} />
        <TabButton label="Pending" value="pending" current={activeTab} onClick={() => { setActiveTab('pending'); setCurrentPage(1); }} />
      </div>

      {/* Search and Sort */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search users"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="relative">
           <select
              value={sortOrder}
              onChange={(e) => { setSortOrder(e.target.value); setCurrentPage(1); }}
              className="appearance-none w-full md:w-auto pl-3 pr-10 py-2 rounded-lg bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
           >
              <option value="latest">Latest</option>
              <option value="oldest">Oldest</option>
              {/* Other sort options can be added */}
           </select>
           <ChevronDownIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
        <div className="bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-gray-400 text-sm mb-1">Completed</h3>
          <p className="text-3xl font-semibold">{stats.completed.toLocaleString()}</p>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-gray-400 text-sm mb-1">Pending</h3>
          <p className="text-3xl font-semibold">{stats.pending.toLocaleString()}</p>
        </div>
      </div>

      {/* User List */}
      <div className="bg-gray-800 rounded-lg shadow overflow-hidden">
          <ul className="divide-y divide-gray-700">
            {paginatedUsers.map((user) => (
              <UserListItem key={user.id} user={user} onEditClick={handleTierEdit} />
            ))}
            {filteredUsers.length === 0 && (
              <li className="p-6 text-center text-gray-500">No users found matching the criteria.</li>
            )}
          </ul>
        </div>

       {/* Pagination */}
       {totalPages > 1 && (
           <div className="mt-6 flex items-center justify-center space-x-2">
               {/* Item count display */}
               <span className="text-sm text-gray-400 mr-4">
                   Show {itemsPerPage} items
               </span>
               {/* Previous button */}
               <PaginationButton onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                   <ChevronLeftIcon className="h-5 w-5 inline mr-1" />
                   Previous
               </PaginationButton>
               {/* Page numbers (simple version) */}
               {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNumber => (
                  <PaginationButton
                      key={pageNumber}
                      onClick={() => setCurrentPage(pageNumber)}
                      disabled={currentPage === pageNumber}
                      // Add current page style
                      className={`px-3 py-2 rounded-lg text-sm ${
                          currentPage === pageNumber
                              ? 'bg-indigo-600 text-white cursor-default'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                  >
                     {pageNumber}
                  </PaginationButton>
               ))}

               {/* Next button */}
                <PaginationButton onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                   Next
                   <ChevronRightIcon className="h-5 w-5 inline ml-1" />
               </PaginationButton>
           </div>
       )}

    </main>
  );
} 