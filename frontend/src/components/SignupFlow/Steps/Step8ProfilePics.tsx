import React, { ChangeEvent, useState, useEffect, useRef } from 'react';
import styles from './Steps.module.css';
import {  FaPlus } from 'react-icons/fa';

interface SignupData {
    profilePics: (File | null)[];
    // ... other fields
}

interface StepProps {
    data: SignupData;
    setData: (field: keyof SignupData, value: any) => void;
}

const MAX_PICS = 3;

const Step8ProfilePics: React.FC<StepProps> = ({ data, setData }) => {
    const [previews, setPreviews] = useState<(string | null)[]>(Array(MAX_PICS).fill(null));
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [activeSlot, setActiveSlot] = useState<number | null>(null);

    // Generate previews when files change
    useEffect(() => {
        if (!data.profilePics || data.profilePics.length === 0) {
            setPreviews(Array(MAX_PICS).fill(null));
            return;
        }

        // Create object URLs only for actual files, keep null for empty slots
        const newPreviews = data.profilePics.map(file => {
            if (file instanceof File) {
                return URL.createObjectURL(file);
            }
            return null; // Keep null for empty slots
        });
        setPreviews(newPreviews);

        // Free memory when the component is unmounted or previews change
        return () => {
            newPreviews.forEach(url => {
                if (url) {
                    URL.revokeObjectURL(url);
                }
            });
        };
    }, [data.profilePics]);

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0 && activeSlot !== null) {
            const file = event.target.files[0];
            const updatedPics = [...data.profilePics]; // Create a copy
            updatedPics[activeSlot] = file; // Update the specific slot
            setData('profilePics', updatedPics);
        }
        // Reset file input and active slot
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
        setActiveSlot(null);
    };

    const handleRemovePic = (indexToRemove: number) => {
        const updatedPics = [...data.profilePics];
        // Revoke previous object URL if it exists
        const currentPreview = previews[indexToRemove];
        if (currentPreview) {
            URL.revokeObjectURL(currentPreview);
        }
        updatedPics[indexToRemove] = null; // Set slot back to null
        setData('profilePics', updatedPics);
    };

    // Trigger hidden file input click for a specific slot
    const handleSlotClick = (index: number) => {
        if (!data.profilePics[index]) { // Only trigger if slot is empty or has no file
             setActiveSlot(index);
             fileInputRef.current?.click();
        }
    };

    return (
        <div className={styles.stepContainer}>
            <p className={styles.label}>Profile Pictures ({MAX_PICS} required)</p>

            {/* Hidden File Input - now accepts only one file */}
            <input
                ref={fileInputRef}
                type="file"
                id="signup-profile-pics"
                accept="image/png, image/jpeg, image/gif"
                onChange={handleFileChange}
                className={styles.hiddenInput}
            />

            {/* Placeholders / Previews Container */}
            <div className={styles.profileSlotsContainer}>
                {previews.map((previewUrl, index) => (
                    <div
                        key={index}
                        className={`${styles.profileSlot} ${previewUrl ? styles.filledSlot : styles.emptySlot}`}
                        onClick={() => handleSlotClick(index)} // Handle click on the slot itself
                    >
                        {previewUrl ? (
                            <>
                                <img src={previewUrl} alt={`Profile ${index + 1}`} className={styles.previewImage} />
                                <button type="button" onClick={(e) => { e.stopPropagation(); handleRemovePic(index); }} className={styles.removeButton}>&times;</button>
                            </>
                        ) : (
                            <div className={styles.uploadPlaceholder}>
                                <FaPlus size={24} />
                                <span>Upload Photo</span>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Remove or comment out the old drop zone and status text */}
             {/*
             <div className={styles.dropZone} ... > ... </div>
             <p className={styles.statusText} ... > ... </p>
             */}

        </div>
    );
};

export default Step8ProfilePics; 