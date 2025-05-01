import React, { ChangeEvent } from 'react';
import styles from './Steps.module.css';

interface SignupData {
    dob: string;
    // ... other fields
}

interface StepProps {
    data: SignupData;
    setData: (field: keyof SignupData, value: any) => void;
}

const Step5DOB: React.FC<StepProps> = ({ data, setData }) => {
    const handleDobChange = (event: ChangeEvent<HTMLInputElement>) => {
        setData('dob', event.target.value);
    };

    return (
        <div className={styles.stepContainer}>
            <label htmlFor="signup-dob">Date of Birth:</label>
            <input
                type="date"
                id="signup-dob"
                value={data.dob}
                onChange={handleDobChange}
                required
                max={new Date().toISOString().split('T')[0]} // Prevent future dates
            />
        </div>
    );
};

export default Step5DOB; 