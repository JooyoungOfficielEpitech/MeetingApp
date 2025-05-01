import React, { useState, useEffect } from 'react';
import { ResizableBox } from 'react-resizable';
/* import 'react-resizable/css/styles.css'; */ // Keep default styles removed for now
import styles from './ProfileCard.module.css';
import amieLogo from '../../assets/amie_logo.png'; // Reuse logo as placeholder
import * as AppStrings from '../../constants/strings';
import Modal from '../common/Modal'; // Import Modal

// Mock data for the matched user - Updated fields
const matchedUserData = {
    name: '상대방 이름',
    age: 25,
    height: 175, // Added height
    city: '서울',
    photos: [amieLogo, amieLogo, amieLogo] // 3 placeholder photos
    // Removed bio
};

// Interface for ProfileCard Props
interface ProfileCardProps {
    onLeaveChat: () => void; // Add prop for leave chat action
}

const ProfileCard: React.FC<ProfileCardProps> = ({ onLeaveChat }) => {
    const [width, setWidth] = useState(650); // Initial width set to 650
    const [maxConstraints, setMaxConstraints] = useState<[number, number]>([window.innerWidth / 2, Infinity]);
    // State to track unlocked photos (index corresponds to photo index)
    const [unlockedPhotos, setUnlockedPhotos] = useState<boolean[]>([false, false, false]);
    // Remove preview state, add expanded state
    // const [previewPhotoIndex, setPreviewPhotoIndex] = useState<number | null>(null);
    const [expandedPhotoIndex, setExpandedPhotoIndex] = useState<number | null>(null);
    const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false); // State for leave modal

    useEffect(() => {
        const handleResize = () => {
            setMaxConstraints([window.innerWidth / 2, Infinity]);
            // Optional: Adjust width if it exceeds the new max constraint
            if (width > window.innerWidth / 2) {
                setWidth(window.innerWidth / 2);
            }
        };

        window.addEventListener('resize', handleResize);
        handleResize(); // Set initial constraints

        return () => window.removeEventListener('resize', handleResize);
    }, [width]); // Re-run effect if width changes (for the optional adjustment)

    // Handler to unlock a photo
    const handleUnlockPhoto = (index: number) => {
        console.log(`Attempting to unlock photo ${index + 1}`);
        // TODO: Add credit check logic here
        const hasEnoughCredits = true; // Placeholder

        if (hasEnoughCredits) {
            setUnlockedPhotos(prev => prev.map((unlocked, i) => (i === index ? true : unlocked)));
            console.log(`Photo ${index + 1} unlocked!`);
            // TODO: Add credit deduction logic here
        } else {
            console.log("Not enough credits to unlock.");
            // Optionally show a message to the user
        }
    };

    // Remove preview handlers
    // const handleMouseEnterPreview = ...
    // const handleMouseLeavePreview = ...

    // Handler for clicking on a photo container (for expansion)
    const handlePhotoClick = (index: number) => {
        if (unlockedPhotos[index]) { 
            setExpandedPhotoIndex(expandedPhotoIndex === index ? null : index);
        }
    };

    // Function to open the leave confirmation modal
    const handleLeaveChatClick = () => {
        setIsLeaveModalOpen(true);
    };

    // Function to confirm leaving the chat
    const confirmLeaveChat = () => {
        console.log("Leaving chat room...");
        setIsLeaveModalOpen(false);
        onLeaveChat(); // Call the function passed via props
    };

    // Function to close the leave modal
    const closeLeaveModal = () => {
        console.log("Leave chat cancelled.");
        setIsLeaveModalOpen(false);
    };

    return (
        <ResizableBox
            width={width}
            height={Infinity}
            axis="x"
            resizeHandles={['w']}
            // Pass the component instance directly again
            // handle={<CustomWHandle />} 리사이징 가능하게
            onResize={(_event, { size }) => setWidth(size.width)}
            minConstraints={[200, Infinity]}
            maxConstraints={maxConstraints}
            className={styles.resizableBoxWrapper}
        >
            {/* Updated inner content structure */}
            <aside className={styles.profileCard} style={{ width: '100%', height: '100%' }}>
                {/* Photo Grid */}
                <div className={styles.photoGrid}>
                    {matchedUserData.photos.map((photo, index) => (
                        <div 
                            key={index} 
                            className={styles.photoContainer}
                            // Add click listener for expansion
                            onClick={() => handlePhotoClick(index)} 
                        >
                            {/* Show actual photo or placeholder/logo */}
                            <img 
                                src={photo} // Assuming unlocked state reveals this URL
                                alt={`${AppStrings.PROFILECARD_PHOTO_ALT_PREFIX}${matchedUserData.name}${AppStrings.PROFILECARD_PHOTO_ALT_SUFFIX} ${index + 1}`}
                                className={`${styles.profilePhoto} ${!unlockedPhotos[index] ? styles.blurred : ''}`} 
                            />
                            {/* Unlock overlay/button */}
                            {!unlockedPhotos[index] && (
                                <div className={styles.unlockOverlay}>
                                    <button 
                                        className={styles.unlockButton}
                                        onClick={(e) => {
                                            e.stopPropagation(); // Prevent container click
                                            handleUnlockPhoto(index);
                                        }}
                                    >
                                        {AppStrings.PROFILECARD_UNLOCK_BUTTON} {/* Use constant */}
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                
                {/* Text info container */}
                <div className={styles.textInfoContainer}>
                    <div className={styles.infoBox}>
                        <h3>{matchedUserData.name}</h3>
                        <div className={styles.infoRow}>
                            <span>{matchedUserData.age}{AppStrings.PROFILECARD_AGE_SUFFIX}</span>
                            <span> {AppStrings.PROFILECARD_INFO_SEPARATOR} </span>
                            <span>{matchedUserData.height}{AppStrings.PROFILECARD_HEIGHT_SUFFIX}</span>
                        </div>
                        <p className={styles.city}>{matchedUserData.city}</p>
                    </div>
                </div>

                {/* Expanded Photo View Area or Placeholder */}
                {expandedPhotoIndex !== null && unlockedPhotos[expandedPhotoIndex] ? (
                    <div 
                        className={styles.expandedPhotoView}
                        onClick={() => setExpandedPhotoIndex(null)} 
                    >
                        <img 
                            src={matchedUserData.photos[expandedPhotoIndex]} // No non-null needed if logic is correct
                            alt={`${AppStrings.PROFILECARD_EXPANDED_PHOTO_ALT_PREFIX} ${expandedPhotoIndex + 1}`} 
                        />
                    </div>
                ) : (
                    <div className={styles.photoPlaceholder}>
                        <span>{AppStrings.PROFILECARD_PLACEHOLDER_EXPAND}</span>
                    </div>
                )}

                {/* Leave Chat Button - MOVED HERE */}
                <button 
                    onClick={handleLeaveChatClick} 
                    className={`${styles.button} ${styles.leaveChatButton}`}
                >
                    {AppStrings.PROFILECARD_LEAVE_CHAT_BUTTON}
                </button>
                
            </aside>

            {/* Leave Chat Confirmation Modal */}
            <Modal
                isOpen={isLeaveModalOpen}
                onClose={closeLeaveModal}
                title={AppStrings.PROFILECARD_LEAVE_CHAT_MODAL_TITLE}
                footer={
                    <>
                        <button onClick={closeLeaveModal} className={styles.cancelButton}> {/* Assuming general modal styles exist */}
                            {AppStrings.PROFILECARD_LEAVE_CHAT_MODAL_CANCEL_BUTTON}
                        </button>
                        <button onClick={confirmLeaveChat} className={styles.confirmButton}> {/* Assuming general modal styles exist */}
                            {AppStrings.PROFILECARD_LEAVE_CHAT_MODAL_CONFIRM_BUTTON}
                        </button>
                    </>
                }
            >
                <p>{AppStrings.PROFILECARD_LEAVE_CHAT_CONFIRMATION}</p>
            </Modal>

        </ResizableBox>
    );
};

export default ProfileCard; 