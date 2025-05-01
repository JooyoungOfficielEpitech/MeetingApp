import React from 'react';
import Header from '../MainPage/Header'; // Import Header
import Sidebar from '../MainPage/Sidebar'; // Reuse Sidebar from MainPage
import ChatWindow from './ChatWindow';
import ProfileCard from './ProfileCard';
import styles from './ChatPage.module.css';

interface ChatPageProps {
    onNavigateToDashboard: () => void; // Function to navigate back
    onLogout: () => void; // Function for logout
    onNavigateToMyProfile: () => void; // Add new prop type
    onNavigateToSettings: () => void; // Add prop type
    currentView: 'dashboard' | 'chat' | 'my-profile' | 'settings'; // Add prop type
}

const ChatPage: React.FC<ChatPageProps> = ({ onNavigateToDashboard, onLogout, onNavigateToMyProfile, onNavigateToSettings, currentView }) => {
    // Pass the navigation function to the Sidebar
    // Note: Sidebar needs to be updated to accept/use onNavigateToDashboard
    // REMOVE UNUSED FUNCTION
    /*
    const handleSidebarItemClick = (item: string) => {
        if (item === 'Match') {
            onNavigateToDashboard();
        } else if (item === 'Log out') {
            onLogout();
        } else {
            console.log(`Navigate to ${item} (from ChatPage)`);
            // Handle other sidebar clicks if needed, maybe switch content in the middle panel?
        }
    };
    */

    return (
        // Add a wrapper div similar to MainPage's structure
        <div className={styles.pageWrapper}> {/* Assuming a general wrapper style */} 
            <Header /> {/* Add the Header component */} 
            <div className={styles.chatPageContainer}>
                <Sidebar 
                    onLogout={onLogout} 
                    onNavigateToDashboard={onNavigateToDashboard} 
                    onNavigateToMyProfile={onNavigateToMyProfile}
                    onNavigateToSettings={onNavigateToSettings}
                    currentView={currentView} // Pass down
                />
                <main className={styles.chatArea}>
                    <ChatWindow />
                </main>
                <ProfileCard onLeaveChat={onNavigateToDashboard} />
            </div>
            {/* Footer could potentially be added here too if needed */} 
        </div>
    );
};

export default ChatPage; 