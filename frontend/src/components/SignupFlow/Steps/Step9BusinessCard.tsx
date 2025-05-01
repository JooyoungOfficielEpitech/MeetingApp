import React, { ChangeEvent, useState, useEffect, useRef } from 'react';
import styles from './Steps.module.css';
import { FaRegAddressCard, FaPlus } from "react-icons/fa";

interface SignupData {
    businessCard?: File | null;
    profilePics: (File | null)[];
    // ... other fields
}

interface StepProps {
    data: SignupData;
    setData: (field: keyof SignupData, value: any) => void;
}

const Step9BusinessCard: React.FC<StepProps> = ({ data, setData }) => {
    const [preview, setPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!data.businessCard) {
            setPreview(null);
            return;
        }
        if (data.businessCard.type.startsWith('image/')) {
            const objectUrl = URL.createObjectURL(data.businessCard);
            setPreview(objectUrl);
            return () => URL.revokeObjectURL(objectUrl);
        } else {
            setPreview(null); // No preview for non-images like PDF
        }
    }, [data.businessCard]);

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            setData('businessCard', event.target.files[0]);
        } else {
            setData('businessCard', null);
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

     const handleRemove = () => {
        // Revoke previous object URL if it exists
        if (preview) {
            URL.revokeObjectURL(preview);
        }
        setData('businessCard', null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleSlotClick = () => {
        if (!data.businessCard) { // Only trigger if slot is empty
            fileInputRef.current?.click();
        }
    };

    return (
        <div className={styles.stepContainer}>
            <p className={styles.label}>Business Card</p>

            {/* Hidden File Input */}
            <input
                ref={fileInputRef}
                type="file"
                id="signup-business-card"
                accept="image/*,.pdf"
                onChange={handleFileChange}
                className={styles.hiddenInput}
            />

            {/* Single Placeholder Slot */}
            <div className={styles.profileSlotsContainer}> {/* Reuse container style for alignment */}
                 <div
                    className={`${styles.profileSlot} ${data.businessCard ? styles.filledSlot : styles.emptySlot}`}
                    onClick={handleSlotClick}
                 >
                    {data.businessCard ? (
                        <>
                            {preview ? (
                                <img src={preview} alt="Business Card Preview" className={styles.previewImage} />
                            ) : (
                                <div className={styles.fileInfo}>
                                    <FaRegAddressCard size={30} />
                                    <span>{data.businessCard.name}</span>
                                </div>
                            )}
                            <button type="button" onClick={(e) => { e.stopPropagation(); handleRemove(); }} className={styles.removeButton}>&times;</button>
                        </>
                    ) : (
                        <div className={styles.uploadPlaceholder}>
                            <FaPlus size={24} />
                            <span>Upload Card</span>
                        </div>
                    )}
                </div>
                {/* Add empty divs or adjust container style if alignment needs fixing for single item */}
                <div style={{ width: '140px' }}></div> {/* Example spacer */} 
                <div style={{ width: '140px' }}></div> {/* Example spacer */} 
            </div>
        </div>
    );
};

export default Step9BusinessCard; 