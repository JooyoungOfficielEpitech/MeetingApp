import React from 'react';
import Header from './Header.tsx';
import Sidebar from './Sidebar.tsx';
import Footer from './Footer.tsx';
import styles from './MainPage.module.css';
import amieLogo from '../../assets/amie_logo.png'; // Import the logo
// Import strings
import * as AppStrings from '../../constants/strings';

// Placeholder data (replace with actual data later)
const userName = "김주영";
// const profileStatus = "active"; // Use constant instead

// Define props
interface MainPageProps {
    onLogout: () => void;
    onNavigateToChat: () => void;
    onNavigateToMyProfile: () => void;
    onNavigateToSettings: () => void;
    currentView: 'dashboard' | 'chat' | 'my-profile' | 'settings';
}

const MainPage: React.FC<MainPageProps> = ({ onLogout, onNavigateToChat, onNavigateToMyProfile, onNavigateToSettings, currentView }) => {
    
    const handleNavigateToDashboard = () => {
        // TODO: Implement actual navigation logic if needed
        console.log("Navigate to Dashboard requested.");
    };
    
    return (
        <div className={styles.pageContainer}>
            <Header />
            <div className={styles.contentWrapper}>
                <Sidebar 
                    onLogout={onLogout} 
                    onNavigateToDashboard={handleNavigateToDashboard}
                    onNavigateToMyProfile={onNavigateToMyProfile}
                    onNavigateToSettings={onNavigateToSettings}
                    currentView={currentView}
                />
                <main className={styles.mainContent}>
                    {/* Top Logo/Subtitle */}
                    <div className={styles.mainHeader}>
                       <img src={amieLogo} alt="Amié Logo" className={styles.mainLogo} />
                       <p>{AppStrings.MAINPAGE_SUBTITLE}</p> { /* Use constant */}
                    </div>

                    {/* Profile Box */}
                    <section className={styles.contentBox}>
                        <div className={styles.profileHeader}>
                            {/* Use constants for profile title parts */}
                            <span className={styles.profileTitle}>{`${AppStrings.MAINPAGE_PROFILE_TITLE_PREFIX}${userName}${AppStrings.MAINPAGE_PROFILE_TITLE_SUFFIX}`}</span>
                            {/* Use constant for status */}
                            <span className={styles.statusBadge}>{AppStrings.MAINPAGE_STATUS_ACTIVE}</span>
                        </div>
                        {/* Use constant for button text */}
                        <button className={styles.actionButton} onClick={onNavigateToChat}>{AppStrings.MAINPAGE_START_MATCHING_BUTTON}</button>
                    </section>

                    {/* Usage Guide Box */}
                    <section className={styles.contentBox}>
                        {/* Use constant for title */}
                        <h2 className={styles.boxTitle}>{AppStrings.MAINPAGE_USAGE_GUIDE_TITLE}</h2>
                        <ul className={styles.guideList}>
                            {/* Use constants for list items */}
                            <li><span className={styles.guideNumber}>1</span> {AppStrings.MAINPAGE_GUIDE_ITEM_1}</li>
                            <li><span className={styles.guideNumber}>2</span> {AppStrings.MAINPAGE_GUIDE_ITEM_2}</li>
                            <li><span className={styles.guideNumber}>3</span> {AppStrings.MAINPAGE_GUIDE_ITEM_3}</li>
                        </ul>
                    </section>
                </main>
            </div>
            <Footer />
        </div>
    );
};

export default MainPage; 