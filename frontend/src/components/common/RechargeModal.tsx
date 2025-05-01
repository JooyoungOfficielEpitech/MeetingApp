import React, { useState } from 'react';
import styles from './RechargeModal.module.css'; // Create this CSS module file later
import { FaTimes } from 'react-icons/fa';

interface RechargeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (amount: number) => void;
}

const RechargeModal: React.FC<RechargeModalProps> = ({ isOpen, onClose, onConfirm }) => {
    const [amount, setAmount] = useState<number>(10); // Default to 10 credits
    const step = 10; // Recharge step

    if (!isOpen) return null;

    const handleIncrease = () => {
        setAmount(prev => prev + step);
    };

    const handleDecrease = () => {
        setAmount(prev => Math.max(step, prev - step)); // Minimum recharge is 10
    };

    const handleConfirm = () => {
        onConfirm(amount);
    };

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h2>Credit Recharge</h2>
                    <button onClick={onClose} className={styles.closeButton}>
                        <FaTimes />
                    </button>
                </div>
                <div className={styles.modalBody}>
                    <p>Select the amount of credits to recharge (in multiples of {step}):</p>
                    <div className={styles.amountSelector}>
                        <button onClick={handleDecrease} disabled={amount <= step}>-</button>
                        <span>{amount} Credits</span>
                        <button onClick={handleIncrease}>+</button>
                    </div>
                    {/* Optional: Display cost based on amount */}
                    {/* <p>Cost: {amount * pricePerCredit} KRW</p> */}
                </div>
                <div className={styles.modalFooter}>
                    <button onClick={onClose} className={styles.cancelButton}>Cancel</button>
                    <button onClick={handleConfirm} className={styles.confirmButton}>Confirm Recharge</button>
                </div>
            </div>
        </div>
    );
};

export default RechargeModal; 