import React, { ChangeEvent } from 'react';
import styles from './Steps.module.css';

interface SignupData {
    height: string;
    // ... other fields
}

interface StepProps {
    data: SignupData;
    setData: (field: keyof SignupData, value: any) => void;
}

const Step6Height: React.FC<StepProps> = ({ data, setData }) => {
    const handleHeightChange = (event: ChangeEvent<HTMLInputElement>) => {
        // Allow only numbers
        const value = event.target.value.replace(/[^0-9]/g, '');
        setData('height', value);
    };

    return (
        <div className={styles.stepContainer}>
            <label htmlFor="signup-height">Height (cm):</label>
            <input
                type="text" // Use text to easily append 'cm' visually if needed, or handle formatting
                inputMode="numeric" // Hint for mobile keyboards
                id="signup-height"
                value={data.height}
                onChange={handleHeightChange}
                placeholder="Enter your height in cm"
                required
                maxLength={3}
            />
        </div>
    );
};

export default Step6Height; 