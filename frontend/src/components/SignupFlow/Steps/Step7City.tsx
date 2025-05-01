import React, { ChangeEvent } from 'react';
import styles from './Steps.module.css';

interface SignupData {
    city: string;
    // ... other fields
}

interface StepProps {
    data: SignupData;
    setData: (field: keyof SignupData, value: any) => void;
}

const Step7City: React.FC<StepProps> = ({ data, setData }) => {
    const handleCityChange = (event: ChangeEvent<HTMLInputElement>) => {
        setData('city', event.target.value);
    };

    return (
        <div className={styles.stepContainer}>
            <label htmlFor="signup-city">City:</label>
            <input
                type="text"
                id="signup-city"
                value={data.city}
                onChange={handleCityChange}
                placeholder="Enter your city"
                required
            />
             {/* Could potentially use Google Places Autocomplete here */}
        </div>
    );
};

export default Step7City; 