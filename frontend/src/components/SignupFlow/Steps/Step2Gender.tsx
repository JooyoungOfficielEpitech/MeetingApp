import React from 'react';
import styles from './Steps.module.css'; // Create a common CSS module for steps
import { BsGenderMale, BsGenderFemale } from 'react-icons/bs'; // Import icons

interface SignupData {
    gender: 'male' | 'female' | ''; // Updated type, removed 'other'
    // ... other fields
}

interface StepProps {
    data: SignupData;
    setData: (field: keyof SignupData, value: any) => void;
}

const Step2Gender: React.FC<StepProps> = ({ data, setData }) => {
    const handleGenderSelect = (gender: 'male' | 'female') => {
        setData('gender', gender);
    };

    return (
        <div className={styles.stepContainer}>
            <p className={styles.label}>Select your gender:</p>
            <p className={styles.description}>This helps us personalize your experience.</p>
            <div className={styles.buttonGroup}>
                <button
                    type="button"
                    onClick={() => handleGenderSelect('male')}
                    className={`${styles.choiceButton} ${data.gender === 'male' ? styles.selected : ''}`}
                    aria-label="Male"
                >
                    <BsGenderMale size={24} />
                </button>
                <button
                    type="button"
                    onClick={() => handleGenderSelect('female')}
                    className={`${styles.choiceButton} ${data.gender === 'female' ? styles.selected : ''}`}
                    aria-label="Female"
                >
                    <BsGenderFemale size={24} />
                </button>
            </div>
        </div>
    );
};

export default Step2Gender; 