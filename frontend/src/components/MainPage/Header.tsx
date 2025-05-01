import React, { useState } from 'react';
import styles from './Header.module.css';
import { FaCoins } from 'react-icons/fa'; // Changed icon import
import RechargeModal from '../common/RechargeModal'; // Import RechargeModal
// Import strings
import * as AppStrings from '../../constants/strings';

const Header: React.FC = () => {
    // Placeholder for credit count
    const currentCredits = 12; // Renamed variable for clarity

    // State for recharge modal
    const [isModalOpen, setIsModalOpen] = useState(false);

    const openModal = () => setIsModalOpen(true);
    const closeModal = () => setIsModalOpen(false);

    // Placeholder function for handling recharge confirmation
    const handleRecharge = (amount: number) => {
        console.log(`Recharging ${amount} credits...`);
        // TODO: Add actual recharge logic (e.g., API call, update state)
        closeModal();
    };

    return (
        <header className={styles.appHeader}>
            <div className={styles.logoContainer}>
                 {/* Can use image logo here too */}
                 <span className={styles.logoText}>Amié</span>
            </div>
            <div className={styles.userInfo}>
                {/* Use constant for connection status text */}
                <span className={styles.connectionStatus}>
                    <span className={styles.statusDot}></span> {AppStrings.HEADER_CONNECTION_STATUS_CONNECTED}
                </span>
                {/* Updated credit display with new icon */}
                <span className={styles.creditCount}>
                    <FaCoins /> {currentCredits}
                </span>
                {/* Added Recharge button */}
                <button onClick={openModal} className={styles.rechargeButton}>
                    {AppStrings.HEADER_RECHARGE_BUTTON} {/* Use constant */}
                </button>
                {/* Add user profile picture/dropdown later */}
            </div>

            {/* Render Recharge Modal */}
            <RechargeModal
                isOpen={isModalOpen}
                onClose={closeModal}
                onConfirm={handleRecharge}
            />
        </header>
    );
};

export default Header; 