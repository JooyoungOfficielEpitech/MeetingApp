import React, { useState, useRef, ChangeEvent } from 'react';
import styles from './MyProfile.module.css';
import Header from '../MainPage/Header';
import Sidebar from '../MainPage/Sidebar'; // Import Sidebar
import amieLogo from '../../assets/amie_logo.png'; // Placeholder image
import { FaTimes } from 'react-icons/fa'; // Import X icon
// Import strings
import * as AppStrings from '../../constants/strings';

interface MyProfileProps {
    onNavigateToDashboard: () => void;
    // Need to add other nav props for Sidebar
    onLogout: () => void;
    onNavigateToMyProfile: () => void; // Pass this for active state if needed
    onNavigateToSettings: () => void; // Add prop type
    currentView: 'dashboard' | 'chat' | 'my-profile' | 'settings'; // Add prop type
}

const MyProfile: React.FC<MyProfileProps> = ({ 
    onNavigateToDashboard, 
    onLogout, 
    onNavigateToMyProfile, 
    onNavigateToSettings,
    currentView 
}) => {
    // Use null for empty photo slots
    const originalUserProfile = {
        name: '김주영 (본인)',
        age: 28, 
        height: 165,
        city: '부산',
        photos: [amieLogo, amieLogo, null] // Example with one empty slot initially
    };

    // State for editable profile data (allow null for photos)
    const [profileData, setProfileData] = useState<{
        name: string;
        age: number;
        height: number;
        city: string;
        photos: (string | null)[]; // Allow null for empty slots
    }>(originalUserProfile);
    // State for edit mode
    const [isEditing, setIsEditing] = useState(false);

    // Refs for file inputs
    const fileInputRefs = [
        useRef<HTMLInputElement>(null),
        useRef<HTMLInputElement>(null),
        useRef<HTMLInputElement>(null),
    ];

    // Handle input changes
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setProfileData(prev => ({
            ...prev,
            // Convert age and height back to numbers if needed
            [name]: (name === 'age' || name === 'height') ? Number(value) || 0 : value
        }));
    };

    // Handle saving changes - validation checks for null
    const handleSave = () => {
        const allPhotosFilled = profileData.photos.every(photo => photo !== null && photo !== '');
        if (!allPhotosFilled) {
            alert(AppStrings.MYPROFILE_ALERT_NEED_3_PHOTOS); // Use constant
            return; 
        }
        console.log("Saving profile:", profileData);
        setIsEditing(false); 
    };

    // Handle canceling edit - reset to original (which might have nulls)
    const handleCancel = () => {
        setProfileData(originalUserProfile); 
        setIsEditing(false);
    };

    // Handle triggering file input click
    const handlePhotoClick = (index: number) => {
        if (isEditing) {
            fileInputRefs[index].current?.click();
        }
    };

    // Handle file selection - ensure result is treated as string
    const handlePhotoUpload = (event: ChangeEvent<HTMLInputElement>, index: number) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setProfileData(prev => {
                    const newPhotos = [...prev.photos];
                    newPhotos[index] = reader.result as string; // Result is always a string (Data URL)
                    return { ...prev, photos: newPhotos };
                });
            };
            reader.readAsDataURL(file);
            event.target.value = ''; 
        }
    };

    // Handle photo deletion - set to null
    const handlePhotoDelete = (index: number, e: React.MouseEvent) => {
        e.stopPropagation(); 
        console.log(`Deleting photo ${index + 1}`);
        setProfileData(prev => {
            const newPhotos = [...prev.photos];
            newPhotos[index] = null; // Set slot to null
            return { ...prev, photos: newPhotos };
        });
    };

    return (
        <div className={styles.pageWrapper}>
            <Header /> 
            <div className={styles.contentWrapper}>
                {/* Add Sidebar for consistent navigation */}
                <Sidebar 
                    onLogout={onLogout}
                    onNavigateToDashboard={onNavigateToDashboard}
                    onNavigateToMyProfile={onNavigateToMyProfile}
                    onNavigateToSettings={onNavigateToSettings}
                    currentView={currentView} // Pass down
                />
                
                <main className={styles.mainContent}>
                    {/* Use constants for title */}
                    <h2>{AppStrings.MYPROFILE_TITLE} {isEditing ? AppStrings.MYPROFILE_EDITING_SUFFIX : ''}</h2>
                    
                    <div className={styles.profileCardLike}> {/* New wrapper class */} 
                        {/* Photo Grid */}
                        <div className={styles.photoGrid}>
                            {profileData.photos.map((photoUrl, index) => (
                                <div 
                                    key={index} 
                                    className={`${styles.photoContainer} ${isEditing ? styles.editablePhoto : ''}`}
                                    onClick={() => handlePhotoClick(index)} 
                                >
                                    {/* Hidden file input */} 
                                    <input 
                                        type="file"
                                        ref={fileInputRefs[index]}
                                        style={{ display: 'none' }}
                                        accept="image/*"
                                        onChange={(e) => handlePhotoUpload(e, index)}
                                    />
                                    
                                    {/* Conditional Rendering based on photoUrl */}
                                    {photoUrl ? (
                                        // If photo exists, show image and delete button (in edit mode)
                                        <>
                                            <img 
                                                src={photoUrl} 
                                                alt={`Profile ${index + 1}`}
                                                className={styles.profilePhoto} 
                                            />
                                            {isEditing && (
                                                <button 
                                                    className={styles.deletePhotoButton}
                                                    onClick={(e) => handlePhotoDelete(index, e)}
                                                    title={AppStrings.MYPROFILE_DELETE_PHOTO_TITLE} // Use constant
                                                >
                                                    <FaTimes />
                                                </button>
                                            )}
                                        </>
                                    ) : (
                                        // If photo is null/empty
                                        isEditing ? (
                                            // Show upload prompt in edit mode
                                            <div className={styles.uploadPrompt}>
                                                {AppStrings.MYPROFILE_UPLOAD_PROMPT} { /* Use constant */}
                                            </div>
                                        ) : (
                                            // Show placeholder logo in view mode
                                            <img 
                                                src={amieLogo} 
                                                alt={`Upload photo ${index + 1}`}
                                                className={`${styles.profilePhoto} ${styles.placeholderLogo}`}
                                            />
                                        )
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Info Box - Conditionally render inputs/text */}
                        <div className={styles.infoBox}>
                            <div className={styles.infoItem}>
                                <label>{AppStrings.MYPROFILE_LABEL_NICKNAME}</label> { /* Use constant */}
                                {isEditing ? (
                                    <input type="text" name="name" value={profileData.name} onChange={handleChange} className={styles.inputField} />
                                ) : (
                                    <span>{profileData.name}</span>
                                )}
                            </div>
                            <div className={styles.infoItem}>
                                <label>{AppStrings.MYPROFILE_LABEL_AGE}</label> { /* Use constant */}
                                {isEditing ? (
                                    <input type="number" name="age" value={profileData.age} onChange={handleChange} className={styles.inputFieldSmall} />
                                ) : (
                                    <span>{profileData.age}세</span>
                                )}
                            </div>
                            <div className={styles.infoItem}>
                                <label>{AppStrings.MYPROFILE_LABEL_HEIGHT}</label> { /* Use constant */}
                                {isEditing ? (
                                    <input type="number" name="height" value={profileData.height} onChange={handleChange} className={styles.inputFieldSmall} />
                                ) : (
                                    <span>{profileData.height}cm</span>
                                )}
                            </div>
                            <div className={styles.infoItem}>
                                <label>{AppStrings.MYPROFILE_LABEL_CITY}</label> { /* Use constant */}
                                {isEditing ? (
                                    <input type="text" name="city" value={profileData.city} onChange={handleChange} className={styles.inputField} />
                                ) : (
                                    <span>{profileData.city}</span>
                                )}
                            </div>
                        </div>

                        {/* Edit/Save/Cancel Buttons */}
                        <div className={styles.buttonContainer}>
                            {isEditing ? (
                                <>
                                    <button 
                                        onClick={handleSave} 
                                        className={`${styles.button} ${styles.saveButton}`}
                                        // Update disabled check for null
                                        disabled={!profileData.photos.every(photo => photo !== null && photo !== '')}
                                    >
                                        {AppStrings.MYPROFILE_BUTTON_SAVE} { /* Use constant */}
                                    </button>
                                    <button onClick={handleCancel} className={`${styles.button} ${styles.cancelButton}`}>
                                        {AppStrings.MYPROFILE_BUTTON_CANCEL} { /* Use constant */}
                                    </button>
                                </> 
                            ) : (
                                <button onClick={() => setIsEditing(true)} className={`${styles.button} ${styles.editButton}`}>
                                    {AppStrings.MYPROFILE_BUTTON_EDIT} { /* Use constant */}
                                </button>
                            )}
                        </div>

                    </div> 
                </main>
            </div>
        </div>
    );
};

export default MyProfile; 