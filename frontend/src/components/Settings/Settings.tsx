import React, { useState } from 'react';
import styles from './Settings.module.css';
import Header from '../MainPage/Header';
import Sidebar from '../MainPage/Sidebar';
import * as AppStrings from '../../constants/strings';
import Modal from '../common/Modal';

interface SettingsProps {
    onNavigateToDashboard: () => void;
    onLogout: () => void;
    onNavigateToMyProfile: () => void;
    onNavigateToSettings: () => void;
    currentView: 'dashboard' | 'chat' | 'my-profile' | 'settings';
}

const Settings: React.FC<SettingsProps> = ({ 
    onNavigateToDashboard, 
    onLogout, 
    onNavigateToMyProfile, 
    onNavigateToSettings,
    currentView 
}) => {
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

    const handleDeleteAccountClick = () => {
        setIsConfirmModalOpen(true);
    };

    const confirmAccountDeletion = () => {
        console.log("Proceeding with account deletion...");
        setIsConfirmModalOpen(false);
        onLogout();
    };

    const closeModal = () => {
        console.log("Account deletion cancelled.");
        setIsConfirmModalOpen(false);
    };

    return (
        <div className={styles.pageWrapper}>
            <Header /> 
            <div className={styles.contentWrapper}>
                <Sidebar 
                    onLogout={onLogout}
                    onNavigateToDashboard={onNavigateToDashboard}
                    onNavigateToMyProfile={onNavigateToMyProfile}
                    onNavigateToSettings={onNavigateToSettings}
                    currentView={currentView}
                />
                <main className={styles.mainContent}>
                    <h2>{AppStrings.SETTINGS_TITLE}</h2>
                    
                    <section className={styles.settingsSection}>
                        <h3>{AppStrings.SETTINGS_DELETE_ACCOUNT_TITLE}</h3>
                        <p>{AppStrings.SETTINGS_DELETE_WARNING}</p>
                        <button 
                            onClick={handleDeleteAccountClick}
                            className={`${styles.button} ${styles.deleteButton}`}
                        >
                            {AppStrings.SETTINGS_DELETE_BUTTON}
                        </button>
                    </section>
                </main>
            </div>

            <Modal
                isOpen={isConfirmModalOpen}
                onClose={closeModal}
                title={AppStrings.SETTINGS_DELETE_MODAL_TITLE}
                footer={
                    <>
                        <button onClick={closeModal} className={styles.cancelButton}>
                            {AppStrings.SETTINGS_DELETE_MODAL_CANCEL_BUTTON}
                        </button>
                        <button onClick={confirmAccountDeletion} className={styles.confirmButton}>
                            {AppStrings.SETTINGS_DELETE_MODAL_CONFIRM_BUTTON}
                        </button>
                    </>
                }
            >
                <p>{AppStrings.SETTINGS_DELETE_CONFIRMATION}</p> 
            </Modal>
        </div>
    );
};

export default Settings; 