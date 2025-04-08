'use client'; // Declare as client component

import React, { useState, ChangeEvent, useEffect } from 'react'; // Added useEffect
import Image from 'next/image'; // Correct import for next/image
import { ArrowLeftIcon, CameraIcon, CalendarIcon, PlusIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

// Define type for image preview
interface ImagePreview {
  file: File;
  previewUrl: string | null; // null for HEIC/HEIF
  fileType: string; // Save file type (e.g., 'image/jpeg', 'image/heic')
}

export default function SignupPage() {
  // State management for each input field (example)
  const [inviteCode, setInviteCode] = useState('INVITE2024'); // Invite code filled as example
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [job, setJob] = useState('');
  const [income, setIncome] = useState('');
  const [mainPicture, setMainPicture] = useState<ImagePreview | null>(null);
  const [additionalPictures, setAdditionalPictures] = useState<ImagePreview[]>([]);
  // TODO: State management for profile pictures
  const [agreements, setAgreements] = useState({
    terms: false,
    privacy: false,
    marketing: false,
  });

  const handleAgreementChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    // Handle "Agree to all" logic
    if (name === 'all') {
      setAgreements({ terms: checked, privacy: checked, marketing: checked });
    } else {
      setAgreements((prev) => ({ ...prev, [name]: checked }));
    }
  };

  // Derived state for "Agree to all" checkbox
  const isAllAgreed = agreements.terms && agreements.privacy && agreements.marketing;
  // Automatically check/uncheck "Agree to all" based on individual checks
  useEffect(() => {
    const allManuallyChecked = agreements.terms && agreements.privacy && agreements.marketing;
    const allCheckbox = document.getElementById('agreement-all') as HTMLInputElement;
    if (allCheckbox) {
        // Check if the change wasn't triggered by the 'all' checkbox itself
        if (allManuallyChecked !== allCheckbox.checked) {
            // Reflect the state of individual checkboxes to the 'all' checkbox
            // This part is tricky if we allow 'all' to control others.
            // Let's simplify: 'all' only reflects the combined state if it wasn't the trigger
        }
    }
  }, [agreements.terms, agreements.privacy, agreements.marketing]);

  // File validation function
  const isValidImageFile = (file: File): boolean => {
    const acceptedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const acceptedExtensions = ['.heic', '.heif'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();

    return acceptedImageTypes.includes(file.type) || acceptedExtensions.includes(fileExtension);
  };

  // Function to check file type (HEIC/HEIF)
  const isHeicFile = (file: File): boolean => {
      const heicExtensions = ['.heic', '.heif'];
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      // File type might be empty or application/octet-stream for HEIC
      return heicExtensions.includes(fileExtension) || file.type === '' || file.type === 'application/octet-stream';
  }

  // File input change handler (main picture) - modified
  const handleMainPictureChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        if (isValidImageFile(file)) {
            let previewUrl: string | null = null;
            const isHeic = isHeicFile(file);

            // Revoke existing preview URL
            if (mainPicture?.previewUrl) {
              URL.revokeObjectURL(mainPicture.previewUrl);
            }

            if (!isHeic) {
               previewUrl = URL.createObjectURL(file); // Create preview if not HEIC
            }

            setMainPicture({ file, previewUrl, fileType: isHeic ? 'image/heic' : file.type });

        } else {
            alert("Unsupported file format. (jpg, png, gif, webp, heic, heif)"); // Translated
            // Remove existing picture
            removeMainPicture();
        }
    }
    e.target.value = ''; // Reset input
  };

  // File input change handler (additional pictures) - modified
  const handleAdditionalPicturesChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
       const currentCount = additionalPictures.length;
       const availableSlots = 3 - currentCount;
       let addedCount = 0;
       const invalidFiles: string[] = [];

       const newPictures: ImagePreview[] = [...additionalPictures];

       for (let i = 0; i < files.length && addedCount < availableSlots; i++) {
         const file = files[i];
         if (isValidImageFile(file)) {
            let previewUrl: string | null = null;
            const isHeic = isHeicFile(file);
            if (!isHeic) {
                previewUrl = URL.createObjectURL(file);
            }
            newPictures.push({ file, previewUrl, fileType: isHeic ? 'image/heic' : file.type });
            addedCount++;
         } else {
            invalidFiles.push(file.name);
         }
       }
       setAdditionalPictures(newPictures);

       if (invalidFiles.length > 0) {
           alert(`Unsupported file format: ${invalidFiles.join(', ')}\n(jpg, png, gif, webp, heic, heif)`); // Translated
       }
       if (files.length > availableSlots) {
           alert(`You can register up to 3 additional pictures. Only ${availableSlots} were added.`); // Translated
       }
    }
    e.target.value = ''; // Reset input
  };

  // Image removal handler (main) - modified
  const removeMainPicture = () => {
    if (mainPicture?.previewUrl) { // Only revoke if previewUrl exists
      URL.revokeObjectURL(mainPicture.previewUrl);
    }
    setMainPicture(null);
  };

  // Image removal handler (additional) - modified
  const removeAdditionalPicture = (index: number) => {
    const pictureToRemove = additionalPictures[index];
    if (pictureToRemove?.previewUrl) { // Only revoke if previewUrl exists
        URL.revokeObjectURL(pictureToRemove.previewUrl);
    }
    setAdditionalPictures(prev => prev.filter((_, i) => i !== index));
  };

  // Cleanup preview URLs on component unmount - modified
  useEffect(() => {
    return () => {
      if (mainPicture?.previewUrl) { // Only revoke if previewUrl exists
        URL.revokeObjectURL(mainPicture.previewUrl);
      }
      additionalPictures.forEach(p => {
          if (p.previewUrl) { // Only revoke if previewUrl exists
            URL.revokeObjectURL(p.previewUrl);
          }
      });
    };
  }, [mainPicture, additionalPictures]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (password !== passwordConfirm) {
      alert('Passwords do not match.'); // Translated
      return;
    }
    // TODO: Add validation for required main picture
    if (!mainPicture) {
        alert('Please register your main profile picture.'); // Translated
        return;
    }
    // Check required agreements
    if (!agreements.terms || !agreements.privacy) {
        alert('Please agree to the required Terms of Service and Privacy Policy.');
        return;
    }

    const signupData = {
      inviteCode,
      email,
      password,
      name,
      birthDate,
      gender,
      height: Number(height) || null,
      weight: Number(weight) || null,
      job,
      income,
      mainPictureInfo: mainPicture ? { name: mainPicture.file.name, type: mainPicture.fileType } : null,
      additionalPicturesInfo: additionalPictures.map(p => ({ name: p.file.name, type: p.fileType })),
      agreements: {
        terms: agreements.terms,
        privacy: agreements.privacy,
        marketing: agreements.marketing,
      }
    };

    console.log('--- Sign Up Request Data (Mocking) ---'); // Translated
    console.log('POST /api/signup (virtual)'); // Translated
    console.log(JSON.stringify(signupData, null, 2)); // Check file type info included

    try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 500)); 
        alert('Sign up request sent successfully. (Mocking)\nYou can use the service after admin approval.'); // Translated
        // TODO: Redirect after successful sign up
    } catch (error) {
        console.error('Mock Signup Error:', error);
        alert('An error occurred during sign up processing. (Mocking)'); // Translated
    }
  };

  // Tailwind CSS classes for styling
  const inputBaseStyle = "w-full p-3 rounded bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelStyle = "block text-sm font-medium text-gray-300 mb-1";
  const buttonBaseStyle = "w-full p-3 rounded";
  const imageButtonStyle = "relative aspect-square flex flex-col items-center justify-center border-2 border-dashed border-gray-600 rounded text-gray-400 hover:border-gray-500 hover:text-gray-300 cursor-pointer overflow-hidden p-1"; // Added padding
  const imagePreviewStyle = "absolute inset-0 w-full h-full object-cover";
  const removeButtonStyle = "absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs focus:outline-none hover:bg-red-700 z-10"; // Added z-index

  // File icon SVG (for HEIC display)
  const FileIcon = () => (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-gray-800 p-10 rounded-lg shadow-lg">
        {/* Logo (Temporary text) */}
        <div className="text-center text-2xl font-bold mb-6">logo</div>

        <div>
          <h2 className="text-center text-3xl font-extrabold">Sign Up</h2> {/* Translated */}
          <p className="mt-2 text-center text-sm text-gray-400">
            Sign up with an invite code and start matching {/* Translated */}
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {/* Invite Code */}
          <div>
            <label htmlFor="inviteCode" className={labelStyle}>Invite Code</label> {/* Translated */}
            <input
              id="inviteCode"
              name="inviteCode"
              type="text"
              required
              className={inputBaseStyle}
              placeholder="Enter your invite code" // Translated
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              readOnly // Set as read-only, change if needed
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className={labelStyle}>Email</label> {/* Translated */}
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className={inputBaseStyle}
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className={labelStyle}>Password</label> {/* Translated */}
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              className={inputBaseStyle}
              placeholder="Enter your password" // Translated
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="passwordConfirm" className={labelStyle}>Confirm Password</label> {/* Translated */}
            <input
              id="passwordConfirm"
              name="passwordConfirm"
              type="password"
              autoComplete="new-password"
              required
              className={inputBaseStyle}
              placeholder="Confirm your password" // Translated
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
            />
          </div>

          {/* Name */}
          <div>
            <label htmlFor="name" className={labelStyle}>Name</label> {/* Translated */}
            <input
              id="name"
              name="name"
              type="text"
              required
              className={inputBaseStyle}
              placeholder="Enter your name" // Translated
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

           {/* Date of Birth */}
           <div>
            <label htmlFor="birthDate" className={labelStyle}>Date of Birth</label> {/* Translated */}
            <input
              id="birthDate"
              name="birthDate"
              type="date"
              required
              className={`${inputBaseStyle} appearance-none`}
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </div>

           {/* Gender */}
           <div>
            <label className={labelStyle}>Gender</label> {/* Translated */}
            <div className="mt-2 flex space-x-4">
              <label className="inline-flex items-center">
                <input type="radio" className="form-radio text-blue-500 bg-gray-700 border-gray-600 focus:ring-blue-500" name="gender" value="male" checked={gender === 'male'} onChange={() => setGender('male')} required />
                <span className="ml-2 text-gray-300">Male</span> {/* Translated */}
              </label>
              <label className="inline-flex items-center">
                <input type="radio" className="form-radio text-pink-500 bg-gray-700 border-gray-600 focus:ring-pink-500" name="gender" value="female" checked={gender === 'female'} onChange={() => setGender('female')} />
                <span className="ml-2 text-gray-300">Female</span> {/* Translated */}
              </label>
            </div>
          </div>

          {/* Height */}
          <div>
            <label htmlFor="height" className={labelStyle}>Height (cm)</label> {/* Translated */}
            <input
              id="height"
              name="height"
              type="number"
              className={inputBaseStyle}
              placeholder="Enter your height" // Translated
              value={height}
              onChange={(e) => setHeight(e.target.value)}
            />
          </div>

          {/* Weight */}
          <div>
            <label htmlFor="weight" className={labelStyle}>Weight (kg)</label> {/* Translated */}
            <input
              id="weight"
              name="weight"
              type="number"
              className={inputBaseStyle}
              placeholder="Enter your weight" // Translated
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </div>

          {/* Occupation */}
          <div>
            <label htmlFor="job" className={labelStyle}>Occupation</label> {/* Translated */}
            <input
              id="job"
              name="job"
              type="text"
              className={inputBaseStyle}
              placeholder="Enter your occupation" // Translated
              value={job}
              onChange={(e) => setJob(e.target.value)}
            />
          </div>

          {/* Annual Income */}
          <div>
            <label htmlFor="income" className={labelStyle}>Annual Income</label> {/* Translated */}
            <input
              id="income"
              name="income"
              type="text"
              className={inputBaseStyle}
              placeholder="Enter your annual income (e.g., $50,000)" // Translated
              value={income}
              onChange={(e) => setIncome(e.target.value)}
            />
          </div>

          {/* Profile Pictures */}
          <div>
            <label className={labelStyle}>Profile Pictures</label> {/* Translated */}
            <div className="mt-2 grid grid-cols-2 gap-4">
              {/* Main Picture */}
              <div className={imageButtonStyle}>
                 <input type="file" className="absolute inset-0 opacity-0 cursor-pointer z-20" accept="image/*,.heic,.heif" onChange={handleMainPictureChange} />
                 {mainPicture ? (
                   <>
                     {mainPicture.previewUrl ? (
                        <Image src={mainPicture.previewUrl} alt="Main picture preview" layout="fill" objectFit="cover" className={imagePreviewStyle} />
                     ) : (
                        <div className="text-center">
                            <FileIcon />
                            <p className="text-xs mt-1">HEIC file (no preview)</p> {/* Translated */}
                        </div>
                     )}
                     <button type="button" onClick={removeMainPicture} className={removeButtonStyle}>×</button>
                   </>
                 ) : (
                   <div className="text-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      <p className="mt-1 text-xs font-semibold">Main Picture</p> {/* Translated */}
                   </div>
                 )}
              </div>

              {/* Additional Pictures (placeholder for file input trigger) */} 
              <label className={`${imageButtonStyle} ${additionalPictures.length >= 3 ? 'opacity-50 cursor-not-allowed' : ''}`}>
                 <input type="file" multiple className={`absolute inset-0 opacity-0 cursor-pointer z-20 ${additionalPictures.length >= 3 ? 'pointer-events-none' : ''}`} accept="image/*,.heic,.heif" onChange={handleAdditionalPicturesChange} disabled={additionalPictures.length >= 3} />
                 <div className="text-center">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                     <p className="mt-1 text-xs font-semibold">Additional Pictures</p> {/* Translated */}
                 </div>
              </label>

             {/* Display selected additional pictures */} 
              {additionalPictures.map((pic, index) => (
                  <div key={index} className={imageButtonStyle}> 
                       {pic.previewUrl ? (
                            <Image src={pic.previewUrl} alt={`Additional picture ${index + 1} preview`} layout="fill" objectFit="cover" className={imagePreviewStyle} />
                       ) : (
                            <div className="text-center">
                                <FileIcon />
                                <p className="text-xs mt-1">HEIC file (no preview)</p> {/* Translated */}
                            </div>
                       )}
                       <button type="button" onClick={() => removeAdditionalPicture(index)} className={removeButtonStyle}>×</button>
                   </div>
              ))}
            </div>
          </div>

          {/* Agreements */}
          <div className="space-y-4">
             <label className={labelStyle}>Agree to Terms</label> {/* Translated */}
             {/* Agree to All Checkbox */}
             <div className="flex items-center">
                <input
                  id="agreement-all"
                  name="all"
                  type="checkbox"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-500 rounded bg-gray-700"
                  checked={isAllAgreed} // Reflect combined state
                  onChange={handleAgreementChange}
                />
                <label htmlFor="agreement-all" className="ml-2 block text-sm text-gray-300 font-medium">Agree to all</label> {/* Translated */}
             </div>
              <hr className="border-gray-600" />
              {/* Individual Agreements */}
              <div className="flex items-center">
                <input
                  id="agreement-terms"
                  name="terms"
                  type="checkbox"
                  required
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-500 rounded bg-gray-700"
                  checked={agreements.terms}
                  onChange={handleAgreementChange}
                />
                <label htmlFor="agreement-terms" className="ml-2 block text-sm text-gray-400">(Required) Terms of Service</label> {/* Translated */}
                 {/* TODO: Add link to actual terms */}
                <a href="#" target="_blank" rel="noopener noreferrer" className="ml-auto text-xs text-blue-400 hover:underline">[View]</a> 
             </div>
             <div className="flex items-center">
                <input
                  id="agreement-privacy"
                  name="privacy"
                  type="checkbox"
                  required
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-500 rounded bg-gray-700"
                  checked={agreements.privacy}
                  onChange={handleAgreementChange}
                />
                <label htmlFor="agreement-privacy" className="ml-2 block text-sm text-gray-400">(Required) Privacy Policy</label> {/* Translated */}
                 {/* TODO: Add link to actual policy */}
                 <a href="#" target="_blank" rel="noopener noreferrer" className="ml-auto text-xs text-blue-400 hover:underline">[View]</a> 
              </div>
              <div className="flex items-center">
                 <input
                  id="agreement-marketing"
                  name="marketing"
                  type="checkbox"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-500 rounded bg-gray-700"
                  checked={agreements.marketing}
                  onChange={handleAgreementChange}
                />
                 <label htmlFor="agreement-marketing" className="ml-2 block text-sm text-gray-400">(Optional) Agree to receive marketing information</label> {/* Translated */}
              </div>
          </div>

          {/* Submit Button */}
          <div>
            <button
              type="submit"
              className={`${buttonBaseStyle} bg-blue-600 hover:bg-blue-700 text-white font-bold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 disabled:opacity-50`}
              disabled={!agreements.terms || !agreements.privacy || !mainPicture} // Disable if required fields/agreements are missing
            >
              Sign Up {/* Translated */}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 