import React, { useState, useCallback } from 'react';
import SignupModalBase from './SignupModalBase';
import Step1Email from './Steps/Step1Email';
import Step2Gender from './Steps/Step2Gender';
import Step3Password from './Steps/Step3Password';
import Step4Nickname from './Steps/Step4Nickname';
import Step5DOB from './Steps/Step5DOB';
import Step6Height from './Steps/Step6Height';
import Step7City from './Steps/Step7City';
import Step8ProfilePics from './Steps/Step8ProfilePics';
import Step9BusinessCard from './Steps/Step9BusinessCard';
import { SignupData } from '../../types'; // Import from common types file
// import Step2Gender from './Steps/Step2Gender';
// ... import other step components later

interface SignupFlowProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete: (data: SignupData) => void;
}

// Maximum possible steps
const MAX_STEPS = 9;

const SignupFlow: React.FC<SignupFlowProps> = ({ isOpen, onClose, onComplete }) => {
    const [currentStep, setCurrentStep] = useState<number>(1);
    const [signupData, setSignupData] = useState<SignupData>({
        email: '',
        gender: '',
        password: '',
        passwordConfirm: '',
        nickname: '',
        dob: '',
        height: '',
        city: '',
        profilePics: [null, null, null], // Initialize with 3 null slots
        businessCard: null,
    });

    const updateSignupData = useCallback((field: keyof SignupData, value: any) => {
        setSignupData(prev => ({ ...prev, [field]: value }));
    }, []);

    // Determine the actual final step based on gender
    const finalStep = signupData.gender === 'male' ? MAX_STEPS : MAX_STEPS - 1;

    const handleNext = () => {
        // Skip step 9 if gender is not male
        if (currentStep === MAX_STEPS - 1 && signupData.gender !== 'male') {
            onComplete(signupData);
            return;
        }

        if (currentStep < finalStep) {
            setCurrentStep(prev => prev + 1);
        } else {
            onComplete(signupData);
        }
    };

    const handleBack = () => {
        // Skip step 9 if gender is not male when going back from the (non-existent) step 10
        if (currentStep === MAX_STEPS && signupData.gender !== 'male') {
            setCurrentStep(MAX_STEPS - 1);
            return;
        }

        if (currentStep > 1) {
            setCurrentStep(prev => prev - 1);
        }
    };

    const renderStepContent = () => {
        switch (currentStep) {
            case 1: return <Step1Email data={signupData} setData={updateSignupData} />;
            case 2: return <Step2Gender data={signupData} setData={updateSignupData} />;
            case 3: return <Step3Password data={signupData} setData={updateSignupData} />;
            case 4: return <Step4Nickname data={signupData} setData={updateSignupData} />;
            case 5: return <Step5DOB data={signupData} setData={updateSignupData} />;
            case 6: return <Step6Height data={signupData} setData={updateSignupData} />;
            case 7: return <Step7City data={signupData} setData={updateSignupData} />;
            case 8: return <Step8ProfilePics data={signupData} setData={updateSignupData} />;
            case 9: return signupData.gender === 'male' ? <Step9BusinessCard data={signupData} setData={updateSignupData} /> : <div>Invalid Step</div>; // Should not happen if logic is correct
            default: return <div>Step {currentStep} (Not Implemented)</div>;
        }
    };

    const getStepTitle = () => {
        switch (currentStep) {
            case 1: return 'Enter your Email';
            case 2: return 'Select your Gender';
            case 3: return 'Create your Password';
            case 4: return 'Choose your Nickname';
            case 5: return 'Enter your Date of Birth';
            case 6: return 'Enter your Height (cm)';
            case 7: return 'Enter your City';
            case 8: return 'Upload Your Photos';
            case 9: return signupData.gender === 'male' ? 'Upload Business Card' : 'Final Step'; // Adjust title if step 9 is skipped
            default: return `Step ${currentStep}`;
        }
    };

    // Basic validation for enabling the Next button
    const isNextDisabled = (): boolean => {
        switch (currentStep) {
            case 1: return !signupData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupData.email); // Basic email format check
            case 2: return !signupData.gender;
            case 3: return !signupData.password || signupData.password !== signupData.passwordConfirm;
            case 4: return !signupData.nickname;
            case 5: return !signupData.dob;
            case 6: return !signupData.height;
            case 7: return !signupData.city;
            case 8: return signupData.profilePics.filter(p => p !== null).length < 3; // Require all 3 profile pics
            case 9: return signupData.gender === 'male' && !signupData.businessCard; // Require business card if male
            default: return true;
        }
    };

    return (
        <SignupModalBase
            isOpen={isOpen}
            onClose={onClose}
            title={getStepTitle()}
            onNext={handleNext}
            onBack={handleBack}
            isFirstStep={currentStep === 1}
            isLastStep={currentStep === finalStep} // Use dynamic final step
            isNextDisabled={isNextDisabled()}
        >
            {renderStepContent()}
        </SignupModalBase>
    );
}

export default SignupFlow; 