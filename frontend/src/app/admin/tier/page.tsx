'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import axiosInstance from '@/utils/axiosInstance';
import styles from './AdminTierPage.module.css';

// Define User interface (adjust according to your actual User model)
interface User {
    id: number;
    name: string;
    email: string;
    gender: 'male' | 'female' | 'other' | null; // Allow other gender
    status: 'pending_approval' | 'active' | 'rejected' | 'suspended'; // Add suspended status
    createdAt: string;
    updatedAt?: string; // Add updatedAt if available
    // Add detailed fields
    age?: number | null;
    height?: number | null;
    mbti?: string | null;
    profileImageUrls?: string[] | null; // Array of strings
    businessCardImageUrl?: string | null;
    occupation?: string | boolean | null; // Depending on how you store it
    // Keep existing profileImageUrl for card view if needed, or remove if using profileImageUrls[0]
    profileImageUrl?: string; 
}

// --- Define response type for the user list endpoint --- 
interface UserListResponse {
    users: User[];
    totalPages: number;
    currentPage: number;
    totalCount: number;
}
// --- End response type definition ---

// Define interface for the detailed user response (can be same as User if findByPk returns all)
// type DetailedUser = User; // Or define separately if structure differs significantly

// Basic Modal component (replace with your UI library's modal if available)
const Modal = ({ isOpen, onClose, children }: { isOpen: boolean; onClose: () => void; children: React.ReactNode }) => {
    if (!isOpen) return null;
    return (
        <div className={styles.modalOverlay}>
            <div 
                className={styles.modalContent} 
                style={{ maxHeight: '85vh', overflowY: 'auto' }}
            >
                <button onClick={onClose} className={styles.closeButton}>&times;</button>
                {children}
            </div>
        </div>
    );
};

const AdminTierPage: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    // State for the user selected in the list (basic info for modal header/actions)
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    // State for the detailed user data fetched when modal opens
    const [detailedUser, setDetailedUser] = useState<User | null>(null); 
    const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);
    const [detailError, setDetailError] = useState<string | null>(null);
    // --- End new state variables ---
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const router = useRouter();

    // State for button loading
    const [isProcessingAction, setIsProcessingAction] = useState<boolean>(false);

    // ★ State for rejection reason ★
    const [rejectionReason, setRejectionReason] = useState('');

    // ★ State for the status filter ★
    const [statusFilter, setStatusFilter] = useState<string>(''); // Empty string means 'all'

    // ★ State for search term and debounced search term ★
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>('');

    // ★ Debounce effect for search term ★
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
            setPage(1); // Reset page to 1 when search term changes
        }, 500); // 500ms delay

        // Cleanup function to cancel the timeout if searchTerm changes before delay
        return () => {
            clearTimeout(handler);
        };
    }, [searchTerm]);

    const fetchUsers = useCallback(async (currentPage: number, currentFilter: string, currentSearch: string) => {
        setIsLoading(true);
        setError(null);
        console.log(`[Admin Tier] Fetching users - Page: ${currentPage}, Status: ${currentFilter || 'all'}, Search: ${currentSearch || 'none'}`);
        
        const params: { page: number; limit: number; status?: string; search?: string } = {
            page: currentPage,
            limit: 10
        };

        if (currentFilter && currentFilter !== 'all') {
            params.status = currentFilter;
        }
        // Add search term to params if provided
        if (currentSearch) {
            params.search = currentSearch;
        }

        try {
            const response = await axiosInstance.get<UserListResponse>('/api/admin/users', { params });
            console.log('[Admin Tier] Users fetched:', response.data);
            setUsers(response.data.users || []);
            setTotalPages(response.data.totalPages || 1);
            setTotalCount(response.data.totalCount || 0);
            setPage(response.data.currentPage);
        } catch (err: any) {
            console.error('[Admin Tier] Error fetching users:', err);
            setError(err.response?.data?.message || 'Failed to fetch users. Please try again.');
            if (err.response?.status === 401 || err.response?.status === 403) {
                router.push('/admin/login');
            }
        } finally {
            setIsLoading(false);
        }
    }, [router]);

    useEffect(() => {
        fetchUsers(page, statusFilter, debouncedSearchTerm);
    }, [fetchUsers, page, statusFilter, debouncedSearchTerm]);

    const handleViewDetails = async (user: User) => {
        setSelectedUser(user);
        setIsModalOpen(true);
        setIsLoadingDetails(true);
        setDetailError(null);
        setDetailedUser(null);
        setRejectionReason('');
        console.log(`[Admin Tier] View Details clicked for user ID: ${user.id}`);

        try {
            const response = await axiosInstance.get<User>(`/api/admin/users/${user.id}`);
            console.log(`[Admin Tier] Detailed user data fetched for ${user.id}:`, response.data);
            setDetailedUser(response.data);
        } catch (err: any) {
            console.error(`[Admin Tier] Error fetching details for user ${user.id}:`, err);
            setDetailError(err.response?.data?.message || 'Failed to load user details.');
        } finally {
            setIsLoadingDetails(false);
        }
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedUser(null);
        setDetailedUser(null);
        setDetailError(null);
        setRejectionReason('');
        console.log('[Admin Tier] Modal closed.');
    };

    const handleApprove = async (userId: number) => {
        console.log(`[Admin Tier] Attempting to approve user ${userId}`);
        if (isProcessingAction) return;
        setIsProcessingAction(true);
        setError(null);
        setDetailError(null);
        try {
            await axiosInstance.patch(`/api/admin/users/${userId}/approve`);
            console.log(`[Admin Tier] User ${userId} approved successfully.`);
            alert('User approved successfully!');
            fetchUsers(page, statusFilter, debouncedSearchTerm);
            handleCloseModal();
        } catch (err: any) {
            console.error(`[Admin Tier] Error approving user ${userId}:`, err);
            const errorMsg = err.response?.data?.message || 'Failed to approve user.';
            setDetailError(errorMsg);
        } finally {
            setIsProcessingAction(false);
        }
    };

    const handleReject = async (userId: number) => {
        if (!rejectionReason.trim()) {
            alert('거절 사유를 입력해주세요.');
            return;
        }
        if (!confirm('정말로 이 사용자를 거절하시겠습니까?')) return; 
        console.log(`[Admin Tier] Attempting to REJECT user ${userId} with reason: ${rejectionReason}`);
        if (isProcessingAction) return;
        setIsProcessingAction(true);
        setError(null);
        setDetailError(null);
        try {
            await axiosInstance.patch(`/api/admin/users/${userId}/reject`, { reason: rejectionReason }); 
            console.log(`[Admin Tier] User ${userId} rejected successfully.`);
            alert('사용자 가입을 거절했습니다.');
            fetchUsers(page, statusFilter, debouncedSearchTerm);
            handleCloseModal();
        } catch (err: any) {
            console.error(`[Admin Tier] Error rejecting user ${userId}:`, err);
            const errorMsg = err.response?.data?.message || '사용자 거절 처리 중 오류가 발생했습니다.';
            setDetailError(errorMsg);
        } finally {
            setIsProcessingAction(false);
        }
    };

    // ★ NEW: Handler for Permanently Deleting a User ★
    const handleDelete = async (userId: number) => {
        if (!confirm('ALERT! This will permanently delete the user and all associated data (profile, matches, messages, etc.). This action cannot be undone. Proceed?')) return;
        
        console.log(`[Admin Tier] Attempting to PERMANENTLY DELETE user ${userId}`);
        if (isProcessingAction) return;
        setIsProcessingAction(true);
        setError(null);
        setDetailError(null);
        try {
            await axiosInstance.delete(`/api/admin/users/${userId}`);
            console.log(`[Admin Tier] User ${userId} permanently deleted successfully.`);
            alert('User permanently deleted successfully!');
            fetchUsers(page, statusFilter, debouncedSearchTerm);
            handleCloseModal();
        } catch (err: any) {
            console.error(`[Admin Tier] Error permanently deleting user ${userId}:`, err);
            const errorMsg = err.response?.data?.message || 'Failed to permanently delete user.';
            setDetailError(errorMsg);
        } finally {
            setIsProcessingAction(false);
        }
    };

    const handleNextPage = () => {
        if (page < totalPages) {
            setPage(page + 1);
        }
    };

    const handlePreviousPage = () => {
        if (page > 1) {
            setPage(page - 1);
        }
    };

    // ★ Helper to format date ★
    const formatDate = (dateString: string) => {
        try {
            return new Date(dateString).toLocaleString(undefined, { 
                year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' 
            });
        } catch {
            return 'Invalid Date';
        }
    };

    // ★ Define table styles (using Tailwind) ★
    const tableHeaderStyle = "px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider";
    const tableCellStyle = "px-4 py-4 whitespace-nowrap text-sm text-slate-200";
    const actionButtonStyle = "px-2.5 py-1.5 text-xs font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed";
    const viewDetailsButtonStyle = `${actionButtonStyle} bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500 mr-2`;
    // ★ Define Delete Button Style ★
    const deleteButtonStyle = `${actionButtonStyle} bg-red-600 hover:bg-red-700 text-white focus:ring-red-500`;

    // ★ Modified filter change handler to reset search term ★
    const handleFilterChange = (newFilter: string) => {
        console.log(`[Admin Tier] Filter changed to: ${newFilter}`);
        setStatusFilter(newFilter);
        setSearchTerm(''); // ★ Reset search term when filter changes ★
        setDebouncedSearchTerm(''); // ★ Reset debounced search term ★
        setPage(1);
    };

    return (
        <div className={styles.container}>
            <h1 className="text-3xl font-bold text-slate-100 mb-6">User Management</h1>
            <p className="text-slate-400 mb-6">Total Users: {totalCount}</p>

            {/* ★ Search Input ★ */} 
            <div className="mb-4">
                 <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={styles.inputStyle}
                 />
            </div>

            {/* ★ Filter Buttons ★ */} 
            <div className="mb-6 flex space-x-2">
                <button 
                    onClick={() => handleFilterChange('')} 
                    className={`${actionButtonStyle} ${statusFilter === '' ? 'bg-amber-600 text-white' : 'bg-slate-600 hover:bg-slate-500 text-slate-200'}`}
                >
                    All
                </button>
                <button 
                    onClick={() => handleFilterChange('pending_approval')} 
                    className={`${actionButtonStyle} ${statusFilter === 'pending_approval' ? 'bg-amber-600 text-white' : 'bg-slate-600 hover:bg-slate-500 text-slate-200'}`}
                >
                    Pending Approval
                </button>
                <button 
                    onClick={() => handleFilterChange('active')} 
                    className={`${actionButtonStyle} ${statusFilter === 'active' ? 'bg-amber-600 text-white' : 'bg-slate-600 hover:bg-slate-500 text-slate-200'}`}
                >
                    Active
                </button>
                 {/* Add 'rejected' filter if needed */}
                 {/* <button 
                    onClick={() => handleFilterChange('rejected')} 
                    className={`${actionButtonStyle} ${statusFilter === 'rejected' ? 'bg-amber-600 text-white' : 'bg-slate-600 hover:bg-slate-500 text-slate-200'}`}
                >
                    Rejected
                </button> */} 
            </div>

            {isLoading && <p>Loading users...</p>}
            {error && <p className="text-red-400 mb-4">{error}</p>}

            {!isLoading && !error && (
                <>
                    {/* ★ Replace Grid with Table ★ */}
                    <div className="overflow-x-auto shadow-md rounded-lg bg-gray-950"> 
                        <table className="min-w-full divide-y divide-slate-700">
                            <thead className="bg-gray-900">
                                <tr>
                                    <th scope="col" className={tableHeaderStyle}>User</th>
                                    <th scope="col" className={tableHeaderStyle}>Email</th>
                                    <th scope="col" className={tableHeaderStyle}>Status</th>
                                    <th scope="col" className={tableHeaderStyle}>Registered</th>
                                    <th scope="col" className={tableHeaderStyle}>Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-gray-950 divide-y divide-slate-800">
                                {users.length > 0 ? (
                                    users.map((user) => (
                                        <tr key={user.id}>
                                            <td className={tableCellStyle}>{user.name}</td>
                                            <td className={tableCellStyle}>{user.email}</td>
                                            <td className={tableCellStyle}>
                                                {/* Display status dynamically */} 
                                                <span className={`${styles.status} ${styles[user.status]}`}>{user.status.replace('_', ' ')}</span>
                                            </td>
                                            <td className={tableCellStyle}>{formatDate(user.createdAt)}</td>
                                            <td className={`${tableCellStyle} space-x-2`}>
                                                {/* Button to trigger modal */}
                                                <button 
                                                    onClick={() => handleViewDetails(user)} 
                                                    className={viewDetailsButtonStyle}
                                                    title="View Details & Actions"
                                                >
                                                    Details
                                                </button>
                                                {/* Other direct actions can be added here if needed */}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                                            No users found 
                                            {debouncedSearchTerm ? ` matching "${debouncedSearchTerm}"` : ''}
                                            {statusFilter ? ` with status: ${statusFilter.replace('_', ' ')}` : ''}.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    {/* ★ End Table ★ */} 

                    {/* Pagination Controls (keep as is) */}
                    {totalPages > 1 && (
                         <div className="mt-6 flex justify-center items-center space-x-4">
                            <button onClick={handlePreviousPage} disabled={page <= 1} className={`${actionButtonStyle} bg-slate-600 hover:bg-slate-500 text-slate-200 disabled:opacity-50`}>Previous</button>
                            <span className="text-sm text-slate-400">Page {page} of {totalPages} (Total: {totalCount})</span>
                            <button onClick={handleNextPage} disabled={page >= totalPages} className={`${actionButtonStyle} bg-slate-600 hover:bg-slate-500 text-slate-200 disabled:opacity-50`}>Next</button>
                        </div>
                    )}

                    {/* User Detail Modal (keep as is, triggered by handleViewDetails) */}
                    <Modal isOpen={isModalOpen} onClose={handleCloseModal}>
                        {selectedUser && (
                            <div className={styles.modalBody}>
                                <h2>User Details - {selectedUser.name} (ID: {selectedUser.id})</h2>
                                
                                {isLoadingDetails && <p>Loading details...</p>}
                                {detailError && <p className={`${styles.error} ${styles.modalError}`}>{detailError}</p>}
                                
                                {!isLoadingDetails && !detailError && detailedUser && (
                                    <>
                                        {/* Basic Info */}
                                        <div className={styles.detailSection}>
                                            <h4>Basic Info</h4>
                                            <p><strong>Name:</strong> {detailedUser.name}</p>
                                            <p><strong>Email:</strong> {detailedUser.email}</p>
                                            <p><strong>Gender:</strong> {detailedUser.gender || '-'}</p>
                                            <p><strong>Age:</strong> {detailedUser.age ?? '-'}</p>
                                            <p><strong>Height:</strong> {detailedUser.height ? `${detailedUser.height} cm` : '-'}</p>
                                            <p><strong>MBTI:</strong> {detailedUser.mbti || '-'}</p>
                                            <p><strong>Status:</strong> <span className={`${styles.status} ${styles[detailedUser.status]}`}>{detailedUser.status.replace('_', ' ')}</span></p>
                                            <p><strong>Occupation:</strong> {detailedUser.occupation?.toString() ?? 'Not Set'}</p>
                                            <p><strong>Joined:</strong> {new Date(detailedUser.createdAt).toLocaleString()}</p>
                                            <p><strong>Last Updated:</strong> {detailedUser.updatedAt ? new Date(detailedUser.updatedAt).toLocaleString() : '-'}</p>
                                        </div>
                                        {/* Profile Pictures */}
                                        <div className={styles.detailSection}>
                                             <h4>Profile Pictures</h4>
                                             <div className={styles.imageGrid}>
                                                {detailedUser.profileImageUrls && detailedUser.profileImageUrls.length > 0 ? (
                                                    detailedUser.profileImageUrls.map((url, index) => (
                                                        <a key={index} href={`${axiosInstance.defaults.baseURL}${url}`} target="_blank" rel="noopener noreferrer" className={styles.imageLink}>
                                                            <img 
                                                                src={`${axiosInstance.defaults.baseURL}${url}`} 
                                                                alt={`Profile ${index + 1}`} 
                                                                className={styles.modalImage} 
                                                                onError={(e) => (e.currentTarget.src = '/default-avatar.png')} 
                                                            />
                                                            {index === 0 && <span className={styles.mainBadge}>Main</span>}
                                                        </a>
                                                    ))
                                                ) : (
                                                    <p>No profile pictures uploaded.</p>
                                                )}
                                            </div>
                                        </div>
                                        {/* Business Card */}
                                        <div className={styles.detailSection}>
                                            <h4>Business Card / Occupation Proof</h4>
                                             {detailedUser.businessCardImageUrl ? (
                                                <a href={`${axiosInstance.defaults.baseURL}${detailedUser.businessCardImageUrl}`} target="_blank" rel="noopener noreferrer">
                                                    <img 
                                                        src={`${axiosInstance.defaults.baseURL}${detailedUser.businessCardImageUrl}`} 
                                                        alt="Business Card" 
                                                        className={styles.modalImage} 
                                                        style={{ maxWidth: '200px', height: 'auto'}}
                                                        onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} // Type assertion
                                                    />
                                                </a>
                                            ) : (
                                                <p>No business card uploaded.</p>
                                            )}
                                        </div>
                                        {/* Rejection Reason Input */}
                                        <div className={styles.detailSection}>
                                            <h4>Rejection Reason</h4>
                                            <textarea
                                                className={styles.rejectionTextarea} 
                                                rows={4}
                                                placeholder="Enter rejection reason here..."
                                                value={rejectionReason}
                                                onChange={(e) => setRejectionReason(e.target.value)}
                                                disabled={isProcessingAction || detailedUser.status !== 'pending_approval'}
                                            />
                                        </div>
                                        {/* Action Buttons */}
                                        <div className={styles.modalActions}>
                                            {detailedUser.status === 'pending_approval' && (
                                                <>
                                                    <button
                                                        onClick={() => handleApprove(detailedUser.id)}
                                                        disabled={isProcessingAction}
                                                        className={`${styles.button} ${styles.approveButton}`}>
                                                        {isProcessingAction ? 'Processing...' : 'Approve'}
                                                    </button>
                                                    <button
                                                        onClick={() => handleReject(detailedUser.id)} 
                                                        disabled={isProcessingAction}
                                                        className={`${styles.button} ${styles.rejectButton}`}>
                                                        {isProcessingAction ? 'Processing...' : 'Reject'}
                                                    </button>
                                                </>
                                            )}
                                            {/* Delete Button for Active Users */} 
                                            {detailedUser.status === 'active' && (
                                                <button
                                                    onClick={() => handleDelete(detailedUser.id)}
                                                    disabled={isProcessingAction}
                                                    className={deleteButtonStyle} // Apply delete style
                                                >
                                                    {isProcessingAction ? 'Deleting...' : 'Delete User'}
                                                </button>
                                            )}
                                            {/* Add other actions for rejected/suspended users if needed */}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </Modal>
                </>
            )}
        </div>
    );
};

export default AdminTierPage; 