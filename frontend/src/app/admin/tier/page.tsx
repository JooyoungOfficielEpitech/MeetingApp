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
    gender: 'male' | 'female' | null;
    status: 'pending_approval' | 'active' | 'rejected';
    createdAt: string;
    // Add other relevant fields like tier, profile picture url, etc.
    profileImageUrl?: string;
}

// Basic Modal component (replace with your UI library's modal if available)
const Modal = ({ isOpen, onClose, children }: { isOpen: boolean; onClose: () => void; children: React.ReactNode }) => {
    if (!isOpen) return null;
    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
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
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
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
            // Call the updated endpoint, no status filter by default (fetches non-rejected)
            const response = await axiosInstance.get('/api/admin/users', {
                params: {
                    page: currentPage,
                    limit: 10 // Or your preferred limit
                }
            });
            console.log('[Admin Tier] Users fetched:', response.data);
            setUsers(response.data.users || []);
            setTotalPages(response.data.totalPages || 1);
            setTotalCount(response.data.totalCount || 0);
            setPage(currentPage);
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

    const handleCardClick = (user: User) => {
        setSelectedUser(user);
        setIsModalOpen(true);
        console.log(`[Admin Tier] User card clicked:`, user);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedUser(null);
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
        if (!confirm('Are you sure you want to reject this user? This action might be irreversible depending on setup.')) return;
        console.log(`[Admin Tier] Attempting to reject user ${userId}`);
        if (isProcessingAction) return;
        setIsProcessingAction(true);
        setError(null); // Clear previous errors
        try {
            await axiosInstance.patch(`/api/admin/users/${userId}/reject`);
            console.log(`[Admin Tier] User ${userId} rejected successfully.`);
            alert('User rejected successfully!');
            // Refresh the user list to reflect the change (rejected user will disappear)
            fetchUsers(page); // Refetch the current page
            handleCloseModal(); // Close modal after action
        } catch (err: any) {
            console.error(`[Admin Tier] Error rejecting user ${userId}:`, err);
            const errorMsg = err.response?.data?.message || 'Failed to reject user.';
            setError(errorMsg);
            alert(`Error: ${errorMsg}`); // Show error to admin
            // Keep modal open on error?
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
                                <h2>User Details</h2>
                                <img
                                    src={selectedUser.profileImageUrl || '/default-avatar.png'}
                                    alt={`${selectedUser.name}'s profile`}
                                    className={styles.modalProfileImage}
                                    onError={(e) => (e.currentTarget.src = '/default-avatar.png')}
                                />
                                <p><strong>ID:</strong> {selectedUser.id}</p>
                                <p><strong>Name:</strong> {selectedUser.name}</p>
                                <p><strong>Email:</strong> {selectedUser.email}</p>
                                <p><strong>Gender:</strong> {selectedUser.gender || 'Not specified'}</p>
                                <p><strong>Status:</strong> <span className={`${styles.status} ${styles[selectedUser.status]}`}>{selectedUser.status.replace('_', ' ')}</span></p>
                                <p><strong>Joined:</strong> {new Date(selectedUser.createdAt).toLocaleDateString()}</p>
                                {/* Add more details as needed */}

                                <div className={styles.modalActions}>
                                    {selectedUser.status === 'pending_approval' && (
                                        <button
                                            onClick={() => handleApprove(selectedUser.id)}
                                            className={`${styles.actionButton} ${styles.approveButton}`}
                                        >
                                            Approve
                                        </button>
                                    )}
                                     {/* Allow rejecting 'active' or 'pending_approval' users */}
                                    {(selectedUser.status === 'pending_approval' || selectedUser.status === 'active') && (
                                        <button
                                            onClick={() => handleReject(selectedUser.id)}
                                             className={`${styles.actionButton} ${styles.rejectButton}`}
                                        >
                                            Reject
                                        </button>
                                    )}
                                     {/* Optionally, add a button to view rejected users or other actions */}
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