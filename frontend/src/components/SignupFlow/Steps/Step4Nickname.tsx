import React, { ChangeEvent } from 'react';
import styles from './Steps.module.css';

interface SignupData {
    nickname: string;
    // ... other fields
}

interface StepProps {
    data: SignupData;
    setData: (field: keyof SignupData, value: any) => void;
}

const Step4Nickname: React.FC<StepProps> = ({ data, setData }) => {
    const handleNicknameChange = (event: ChangeEvent<HTMLInputElement>) => {
        setData('nickname', event.target.value);
    };

    return (
        <div className={styles.stepContainer}>
            <label htmlFor="signup-nickname">Nickname:</label>
            <input
                type="text"
                id="signup-nickname"
                value={data.nickname}
                onChange={handleNicknameChange}
                placeholder="Choose a nickname"
                required
                maxLength={20} // Optional: set max length
            />
            {/* Add nickname availability check logic/message here if needed */}
        </div>
    );
};

export default Step4Nickname; 