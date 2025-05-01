import React from 'react';
import styles from './Sidebar.module.css';
import { FaHeart, FaUser, FaCog, FaSignOutAlt } from 'react-icons/fa'; // Example icons

// Define props
interface SidebarProps {
    onLogout: () => void;
    onNavigateToDashboard: () => void;
    onNavigateToMyProfile: () => void;
    onNavigateToSettings: () => void; // Add prop for Settings navigation
    currentView: 'dashboard' | 'chat' | 'my-profile' | 'settings';
}

const Sidebar: React.FC<SidebarProps> = ({ onLogout, onNavigateToDashboard, onNavigateToMyProfile, onNavigateToSettings, currentView }) => {
    const handleItemClick = (item: string) => {
        switch (item) {
            case 'Match':
                onNavigateToDashboard();
                break;
            case 'Profile':
                onNavigateToMyProfile();
                break;
            case 'Settings':
                onNavigateToSettings(); // Call the new function
                break;
            case 'Log out':
                onLogout();
                break;
            default:
                console.log(`Unknown sidebar item: ${item}`);
        }
    };

    return (
        <aside className={styles.sidebar}>
            <nav>
                <ul>
                    <li
                        className={currentView === 'dashboard' || currentView === 'chat' ? styles.active : ''}
                        onClick={() => handleItemClick('Match')}
                    >
                        <FaHeart /> Match
                    </li>
                    <li
                        className={currentView === 'my-profile' ? styles.active : ''}
                        onClick={() => handleItemClick('Profile')}
                    >
                        <FaUser /> Profile
                    </li>
                    <li
                        className={currentView === 'settings' ? styles.active : ''}
                        onClick={() => handleItemClick('Settings')}
                    >
                        <FaCog /> Settings
                    </li>
                    <li
                        className={''}
                        onClick={() => handleItemClick('Log out')}
                    >
                        <FaSignOutAlt /> Log out
                    </li>
                </ul>
            </nav>
        </aside>
    );
};

export default Sidebar; 