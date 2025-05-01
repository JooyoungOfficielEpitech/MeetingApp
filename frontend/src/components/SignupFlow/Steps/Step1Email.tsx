import React, { ChangeEvent } from 'react';
import { SignupData } from '../../../types'; // Corrected import path again

// Ensure StepProps uses the imported SignupData
interface StepProps {
    data: SignupData;
    setData: (field: keyof SignupData, value: any) => void;
}

const Step1Email: React.FC<StepProps> = ({ data, setData }) => {
    const handleEmailChange = (event: ChangeEvent<HTMLInputElement>) => {
        setData('email', event.target.value);
    };

    return (
        <div>
            <label htmlFor="signup-email">Email Address:</label>
            <input
                type="email"
                id="signup-email"
                value={data.email}
                onChange={handleEmailChange}
                placeholder="your.email@example.com"
                required // Basic HTML5 validation
                autoFocus // Focus on this field when the step loads
            />
            {/* Add validation messages here if needed */}
        </div>
    );
};

export default Step1Email; 