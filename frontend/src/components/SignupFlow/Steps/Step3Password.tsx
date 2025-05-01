import React, { ChangeEvent } from 'react';
import styles from './Steps.module.css';

interface SignupData {
    password: string;
    passwordConfirm: string;
    // ... other fields
}

interface StepProps {
    data: SignupData;
    setData: (field: keyof SignupData, value: any) => void;
}

const Step3Password: React.FC<StepProps> = ({ data, setData }) => {
    const handlePasswordChange = (event: ChangeEvent<HTMLInputElement>) => {
        setData('password', event.target.value);
    };

    const handlePasswordConfirmChange = (event: ChangeEvent<HTMLInputElement>) => {
        setData('passwordConfirm', event.target.value);
    };

    // Basic validation indicator (optional)
    const passwordsMatch = data.password === data.passwordConfirm && data.password !== '';

    return (
        <div className={styles.stepContainer}>
            <label htmlFor="signup-password">Password:</label>
            <input
                type="password"
                id="signup-password"
                value={data.password}
                onChange={handlePasswordChange}
                placeholder="Enter your password"
                required
            />
            <label htmlFor="signup-password-confirm">Confirm Password:</label>
            <input
                type="password"
                id="signup-password-confirm"
                value={data.passwordConfirm}
                onChange={handlePasswordConfirmChange}
                placeholder="Confirm your password"
                required
            />
            {data.passwordConfirm && !passwordsMatch && (
                <p className={styles.errorMessage}>Passwords do not match.</p>
            )}
        </div>
    );
};

export default Step3Password; 