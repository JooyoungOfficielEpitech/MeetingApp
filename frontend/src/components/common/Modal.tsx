import React, { ReactNode } from 'react';
import styles from './Modal.module.css';
import { FaTimes } from 'react-icons/fa';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: ReactNode; // Content of the modal
    footer?: ReactNode; // Optional footer content (e.g., buttons)
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer }) => {
    if (!isOpen) return null;

    return (
        // Overlay / Backdrop
        <div className={styles.modalOverlay} onClick={onClose}>
            {/* Modal Content Box - stopPropagation prevents closing when clicking inside */}
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                {/* Modal Header */}
                <div className={styles.modalHeader}>
                    {title && <h2>{title}</h2>}
                    <button onClick={onClose} className={styles.closeButton}>
                        <FaTimes />
                    </button>
                </div>

                {/* Modal Body */}
                <div className={styles.modalBody}>
                    {children}
                </div>

                {/* Modal Footer */}
                {footer && (
                    <div className={styles.modalFooter}>
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Modal; 