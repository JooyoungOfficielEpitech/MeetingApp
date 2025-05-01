import React from 'react';
import styles from './SignupModalBase.module.css';
import amieLogo from '../../assets/amie_logo.png'; // Import the logo

interface SignupModalBaseProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    onNext: () => void;
    onBack: () => void;
    isFirstStep: boolean;
    isLastStep: boolean;
    isNextDisabled?: boolean; // Optional: Disable next button based on validation
}

const SignupModalBase: React.FC<SignupModalBaseProps> = ({
    isOpen,
    onClose,
    title,
    children,
    onNext,
    onBack,
    isFirstStep,
    isLastStep,
    isNextDisabled = false, // Default to enabled
}) => {
    if (!isOpen) return null;

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContainer} onClick={(e) => e.stopPropagation()}> {/* Prevent closing when clicking inside */}
                <img src={amieLogo} alt="Amié Logo" className={styles.modalLogo} />

                <div className={styles.modalHeader}>
                    <h2>{title}</h2>
                    <button onClick={onClose} className={styles.closeButton}>&times;</button>
                </div>
                <div className={styles.modalBody}>
                    {children}
                </div>
                <div className={styles.modalFooter}>
                    {!isFirstStep && (
                        <button onClick={onBack} className={`${styles.navButton} ${styles.backButton}`}>
                            Back
                        </button>
                    )}
                    <button
                        onClick={onNext}
                        className={`${styles.navButton} ${styles.nextButton}`}
                        disabled={isNextDisabled} // Disable button based on prop
                    >
                        {isLastStep ? 'Finish' : 'Next'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SignupModalBase; 