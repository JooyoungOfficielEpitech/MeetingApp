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

    const fetchUsers = useCallback(async (currentPage: number) => {
        setIsLoading(true);
        setError(null);
        console.log(`[Admin Tier] Fetching users for page ${currentPage}...`);
        try {
            // Use the defined UserListResponse type for the GET request
            const response = await axiosInstance.get<UserListResponse>('/api/admin/users', { // Specify response type
                params: {
                    page: currentPage,
                    limit: 10 // Or your preferred limit
                }
            });
            console.log('[Admin Tier] Users fetched:', response.data);
            // Now response.data is typed as UserListResponse
            setUsers(response.data.users || []);
            setTotalPages(response.data.totalPages || 1);
            setTotalCount(response.data.totalCount || 0);
            setPage(currentPage); // Set current page based on request parameter
        } catch (err: any) {
            console.error('[Admin Tier] Error fetching users:', err);
            setError(err.response?.data?.message || 'Failed to fetch users. Please try again.');
            if (err.response?.status === 401 || err.response?.status === 403) {
                // Redirect to login if unauthorized or forbidden
                router.push('/admin/login');
            }
        } finally {
            setIsLoading(false);
        }
    }, [router]);

    useEffect(() => {
        fetchUsers(page);
    }, [fetchUsers, page]); // Fetch users on initial load and when page changes

    const handleCardClick = async (user: User) => {
        setSelectedUser(user);
        setIsModalOpen(true);
        setIsLoadingDetails(true);
        setDetailError(null);
        setDetailedUser(null);
        console.log(`[Admin Tier] User card clicked, fetching details for user ID: ${user.id}`);

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
        console.log('[Admin Tier] Modal closed.');
    };

    const handleApprove = async (userId: number) => {
        console.log(`[Admin Tier] Attempting to approve user ${userId}`);
        if (isProcessingAction) return;
        setIsProcessingAction(true);
        setError(null); // Clear previous errors
        try {
            await axiosInstance.patch(`/api/admin/users/${userId}/approve`);
            console.log(`[Admin Tier] User ${userId} approved successfully.`);
            alert('User approved successfully!');
            // Refresh the user list to reflect the change
            fetchUsers(page); // Refetch the current page
            handleCloseModal(); // Close modal after action
        } catch (err: any) {
            console.error(`[Admin Tier] Error approving user ${userId}:`, err);
            const errorMsg = err.response?.data?.message || 'Failed to approve user.';
            setError(errorMsg);
            alert(`Error: ${errorMsg}`); // Show error to admin
            // Keep modal open on error to show message or allow retry?
        } finally {
            setIsProcessingAction(false);
        }
    };

    const handleReject = async (userId: number) => {
        if (!confirm('정말로 이 사용자를 영구적으로 삭제하시겠습니까? 이 작업은 되돌릴 수 없으며, 사용자의 모든 데이터와 파일이 삭제됩니다.')) return; // Confirmation message update
        console.log(`[Admin Tier] Attempting to PERMANENTLY DELETE user ${userId}`);
        if (isProcessingAction) return;
        setIsProcessingAction(true);
        setError(null); // Clear previous errors
        setDetailError(null); // Clear detail error as well
        try {
            // Call the DELETE endpoint for permanent deletion
            await axiosInstance.delete(`/api/admin/users/${userId}`); 
            console.log(`[Admin Tier] User ${userId} permanently deleted successfully.`);
            alert('사용자 정보 및 관련 파일이 영구적으로 삭제되었습니다.'); // Updated success message
            // Refresh the user list to reflect the change (deleted user will disappear)
            fetchUsers(page); // Refetch the current page
            handleCloseModal(); // Close modal after action
        } catch (err: any) {
            console.error(`[Admin Tier] Error permanently deleting user ${userId}:`, err);
            const errorMsg = err.response?.data?.message || '사용자 삭제 중 오류가 발생했습니다.'; // Updated error message
            // Set error in the modal instead of alert?
            setDetailError(errorMsg); // Show error within the modal
            // alert(`Error: ${errorMsg}`); // Remove alert
        } finally {
            setIsProcessingAction(false);
        }
    };

    const handleNextPage = () => {
        if (page < totalPages) {
            fetchUsers(page + 1);
        }
    };

    const handlePreviousPage = () => {
        if (page > 1) {
            fetchUsers(page - 1);
        }
    };

    return (
        <div className={styles.container}>
            <h1>Admin - User Management</h1>
            <p>Total Users (non-rejected): {totalCount}</p>

            {/* Add Filters/Search bar later if needed */}

            {isLoading && <p>Loading users...</p>}
            {error && <p className={styles.error}>{error}</p>}

            {!isLoading && !error && (
                <>
                    <div className={styles.userGrid}>
                        {users.length > 0 ? (
                            users.map((user) => (
                                <div key={user.id} className={styles.userCard} onClick={() => handleCardClick(user)}>
                                    <img
                                        src={user.profileImageUrl || '/default-avatar.png'} // Use default if no image
                                        alt={`${user.name}'s profile`}
                                        className={styles.profileImage}
                                        onError={(e) => (e.currentTarget.src = '/default-avatar.png')} // Fallback image
                                    />
                                    <h3>{user.name}</h3>
                                    <p>{user.email}</p>
                                    <p>Status: <span className={`${styles.status} ${styles[user.status]}`}>{user.status.replace('_', ' ')}</span></p>
                                    <p>Gender: {user.gender || 'Not specified'}</p>
                                </div>
                            ))
                        ) : (
                            <p>No users found matching the criteria.</p>
                        )}
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                         <div className={styles.pagination}>
                            <button onClick={handlePreviousPage} disabled={page <= 1}>Previous</button>
                            <span>Page {page} of {totalPages}</span>
                            <button onClick={handleNextPage} disabled={page >= totalPages}>Next</button>
                        </div>
                    )}

                    {/* User Detail Modal */}
                    <Modal isOpen={isModalOpen} onClose={handleCloseModal}>
                        {selectedUser && (
                            <div className={styles.modalBody}>
                                <h2>User Details - {selectedUser.name} (ID: {selectedUser.id})</h2>
                                
                                {isLoadingDetails && <p>Loading details...</p>}
                                {detailError && <p className={styles.error}>{detailError}</p>}
                                
                                {!isLoadingDetails && !detailError && detailedUser && (
                                    <>
                                        {/* --- Display Detailed Info --- */}
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

                                        <div className={styles.detailSection}>
                                            <h4>Profile Pictures</h4>
                                            <div className={styles.imageGrid}>
                                                {detailedUser.profileImageUrls && detailedUser.profileImageUrls.length > 0 ? (
                                                    detailedUser.profileImageUrls.map((url, index) => (
                                                        <a key={index} href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${url}`} target="_blank" rel="noopener noreferrer" className={styles.imageLink}>
                                                            <img 
                                                                src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${url}`} // Prepend Backend URL
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

                                        <div className={styles.detailSection}>
                                            <h4>Business Card / Occupation Proof</h4>
                                            {detailedUser.businessCardImageUrl ? (
                                                <a href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${detailedUser.businessCardImageUrl}`} target="_blank" rel="noopener noreferrer">
                                                    <img 
                                                        src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${detailedUser.businessCardImageUrl}`} // Prepend Backend URL
                                                        alt="Business Card" 
                                                        className={styles.modalImage} 
                                                        style={{ maxWidth: '200px', height: 'auto'}} // Adjust size as needed
                                                        onError={(e) => (e.currentTarget.style.display = 'none')}
                                                    />
                                                </a>
                                            ) : (
                                                <p>No business card uploaded.</p>
                                            )}
                                        </div>
                                        {/* --- End Display Detailed Info --- */}
                                    </>
                                )}

                                <div className={styles.modalActions}>
                                    {selectedUser.status === 'pending_approval' && (
                                        <button
                                            onClick={() => handleApprove(selectedUser.id)}
                                            className={`${styles.actionButton} ${styles.approveButton}`}
                                            disabled={isProcessingAction}
                                        >
                                            {isProcessingAction ? 'Processing...' : 'Approve'}
                                        </button>
                                    )}
                                    {(selectedUser.status === 'pending_approval' || selectedUser.status === 'active') && (
                                        <button
                                            onClick={() => handleReject(selectedUser.id)}
                                             className={`${styles.actionButton} ${styles.rejectButton}`}
                                             disabled={isProcessingAction}
                                        >
                                            {isProcessingAction ? 'Processing...' : 'Reject'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </Modal>
                </>
            )}
        </div>
    );
};

export default AdminTierPage; 