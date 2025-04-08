'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { ArrowLeftIcon, CameraIcon, CalendarIcon, PlusIcon } from '@heroicons/react/24/outline';
import Link from 'next/link'; // For the back button
import { Montserrat, Inter } from 'next/font/google'; // Import fonts

// Initialize fonts
const montserrat = Montserrat({ subsets: ['latin'], weight: ['600', '700'] }); // Semibold/Bold weights
const inter = Inter({ subsets: ['latin'] });

// Define interface for profile data (can be expanded)
interface UserProfile {
  name: string;
  email: string;
  dob: string; // Date of birth YYYY-MM-DD
  age: number; // Calculated or stored
  weight: number | string; // number or empty string
  phone: string;
  address1: string; // Main address
  address2: string; // Detailed address
  occupation: string;
  income: string; // e.g., "$50,000"
  profilePictureUrl: string;
  thumbnails: string[];
  // Password fields are handled separately for security/UX
}

// Reusable Input Group Component
interface InputGroupProps {
  label: string;
  id: string;
  name: string;
  type?: string;
  value: string | number; // Allow number for age/weight
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  readOnly?: boolean;
  icon?: React.ReactNode;
  containerClassName?: string;
}

const InputGroup = ({
  label,
  id,
  name,
  type = 'text',
  value,
  onChange,
  placeholder,
  readOnly = false,
  icon,
  containerClassName = ""
}: InputGroupProps) => (
  <div className={containerClassName}>
    {label && <label htmlFor={id} className={`block text-sm font-medium text-slate-400 mb-1 ${montserrat.className}`}>{label}</label>} {/* Adjusted color, Montserrat font */}
    <div className="relative">
      <input
        type={type}
        id={id}
        name={name}
        value={value} // Keep value as is (string or number)
        onChange={onChange}
        placeholder={placeholder || (typeof label === 'string' ? label : '')} // Use label as placeholder if not provided
        readOnly={readOnly}
        className={`w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-full focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent ${readOnly ? 'text-slate-500 cursor-not-allowed' : 'text-slate-100'} ${icon ? 'pr-10' : ''}`} // Adjusted colors, rounded-full, amber focus
        step={type === 'number' ? 'any' : undefined}
      />
      {icon && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            {icon} {/* Icon color might need adjustment based on context - assuming gray/slate is okay */}
          </div>
      )}
    </div>
  </div>
);


export default function ProfileManagementPage() {
  // State for profile data (using mock data initially)
  const [profile, setProfile] = useState<UserProfile>({
    name: 'Minji Kim',
    email: 'minji.kim@email.com',
    dob: '1995-03-15',
    age: 29, // Could be calculated
    weight: 55,
    phone: '010-1234-5678',
    address1: '123 Teheran-ro, Gangnam-gu, Seoul',
    address2: 'Apt 456',
    occupation: 'Software Engineer',
    income: '$50,000',
    profilePictureUrl: '/img/placeholder-profile.jpg', // Keep placeholder
    thumbnails: [
      '/img/placeholder-thumb1.jpg',
      '/img/placeholder-thumb2.jpg',
      '/img/placeholder-thumb3.jpg',
    ],
  });

  // State for password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profilePicError, setProfilePicError] = useState(false);
  const [thumbErrors, setThumbErrors] = useState<boolean[]>(Array(profile.thumbnails.length).fill(false));

  // Handler for input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    let processedValue: string | number = value;

    if (type === 'number') {
        processedValue = value === '' ? '' : parseFloat(value);
        if (isNaN(processedValue as number)) {
             processedValue = '';
        }
    }

    // Calculate age if dob changes
    if (name === 'dob') {
        try {
            const birthDate = new Date(value);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
            if (!isNaN(age) && age >= 0) {
                 setProfile(prev => ({ ...prev, [name]: value, age: age }));
                 return;
            } else {
                 setProfile(prev => ({ ...prev, [name]: value, age: 0 }));
                 return;
            }
        } catch (error) {
            console.error("Error calculating age:", error);
             setProfile(prev => ({ ...prev, [name]: value, age: 0 }));
             return;
        }
    }

    setProfile(prev => ({ ...prev, [name]: processedValue }));
  };

  const handleSave = () => {
    if (newPassword && newPassword !== confirmPassword) {
        alert('New password and confirmation password do not match.');
        return;
    }
    console.log('Mock API Call: Saving profile data:', profile); // Enhanced log
    if (newPassword) {
        console.log('Mock API Call: Saving new password (details omitted for security)'); // Enhanced log
    }
    alert('Profile save logic needs implementation.');
  };

  const handleCancel = () => {
    console.log('Cancelled profile edit');
    alert('Cancel logic needs implementation (e.g., reset data or go back).');
    // Optionally reset state or use router.back()
    // router.back(); // Example if needed
  };

  // Mock handler for phone verification
  const handlePhoneVerify = () => {
    console.log(`Mock API Call: Requesting phone verification for ${profile.phone}`); // Log added
    alert('Phone number verification logic needs implementation.');
  };

  // Image error handlers
  const handleProfilePicError = () => {
      console.error("Error loading profile picture:", profile.profilePictureUrl);
      setProfilePicError(true);
  }

  const handleThumbnailError = (index: number) => {
      console.error(`Error loading thumbnail ${index + 1}:`, profile.thumbnails[index]);
      setThumbErrors(prev => {
          const newErrors = [...prev];
          newErrors[index] = true;
          return newErrors;
      });
  }

  return (
    <div className={`min-h-screen bg-black text-slate-100 flex flex-col ${inter.className}`}> {/* Black bg, Inter font */}
      {/* Header */}
      <header className={`bg-gray-950 p-4 flex items-center sticky top-0 z-10 shadow-md ${inter.className}`}> {/* Dark gray bg, Inter font */}
        {/* Back button Link */}
        <Link href="/main" className="text-slate-100 hover:text-slate-300 mr-4"> {/* Points to /main */}
            <ArrowLeftIcon className="h-6 w-6" />
        </Link>
        <h1 className={`text-xl font-semibold ${montserrat.className}`}>Profile Management</h1> {/* Montserrat font */}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        {/* Wrap content in a card */}
        <div className="max-w-2xl mx-auto bg-gray-950 rounded-2xl p-6 md:p-10 shadow-xl"> {/* Dark gray bg, rounded-2xl, padding */}

          {/* Profile Picture Section */}
          <section className="mb-8 flex flex-col items-center">
            <div className="relative mb-4">
              {profilePicError ? (
                <div className="w-32 h-32 rounded-full border-4 border-amber-500 bg-gray-800" /> /* Empty div on error */
              ) : (
                <Image
                  src={profile.profilePictureUrl} // Use state value
                  alt="Profile picture"
                  width={128}
                  height={128}
                  className="rounded-full object-cover border-4 border-amber-500 bg-gray-800" // Amber border, darker bg for error/loading
                  onError={handleProfilePicError} // Use error handler
                  priority // Prioritize loading main profile pic
                />
              )}
              <button className="absolute bottom-1 right-1 bg-gray-800 rounded-full p-2 text-white hover:bg-gray-700 cursor-pointer"> {/* Darker button bg */}
                <CameraIcon className="h-5 w-5" />
                {/* Hidden file input for profile picture */}
                <input
                     type="file"
                     className="absolute inset-0 opacity-0 cursor-pointer"
                     accept="image/*"
                     onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                            console.log(`Mock API Call: Preparing to upload profile picture: ${file.name}`); // Log added
                            // TODO: Handle actual file upload
                        }
                     }}
                 />
              </button>
            </div>
            <p className={`text-xl font-semibold mb-4 ${montserrat.className}`}>{profile.name}</p> {/* Display name from state, Montserrat font */}
            {/* Thumbnails */}
            <div className="flex space-x-3">
              {profile.thumbnails.map((thumb, index) => (
                <div key={index} className="relative w-16 h-16">
                  {thumbErrors[index] ? (
                    <div className="w-16 h-16 rounded-lg bg-gray-800" /> /* Empty div on error */
                  ) : (
                    <Image
                      src={thumb}
                      alt={`Thumbnail ${index + 1}`}
                      width={64}
                      height={64}
                      className="rounded-lg object-cover bg-gray-800" // Darker bg for error/loading
                      onError={() => handleThumbnailError(index)} // Use error handler
                    />
                  )}
                 </div>
              ))}
              {/* Add new thumbnail button */}
               <div className="relative w-16 h-16">
                  <button className="w-full h-full bg-gray-800 rounded-full flex items-center justify-center text-slate-400 hover:bg-gray-700 cursor-pointer"> {/* Darker bg, rounded-full, adjusted color/hover */}
                    <PlusIcon className="h-8 w-8" />
                     {/* Hidden file input for adding thumbnails */}
                     <input
                         type="file"
                         className="absolute inset-0 opacity-0 cursor-pointer"
                         accept="image/*"
                         multiple // Allow multiple file selection
                         onChange={(e) => {
                            const files = e.target.files;
                            if (files && files.length > 0) {
                                const fileNames = Array.from(files).map(f => f.name).join(', ');
                                console.log(`Mock API Call: Preparing to upload thumbnail(s): ${fileNames}`); // Log added
                                // TODO: Handle actual file upload
                            }
                         }}
                     />
                  </button>
               </div>
            </div>
          </section>

          {/* Form Sections - Wrap remaining sections in a form or handle save differently */}
          {/* <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}> */}
            {/* Basic Information Section */}
            <section className="mb-8">
              <h2 className={`text-lg font-semibold mb-4 border-b border-gray-700 pb-2 ${montserrat.className}`}>Basic Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <InputGroup label="Name" id="name" name="name" value={profile.name} onChange={handleChange} readOnly />
                <InputGroup label="Email" id="email" name="email" type="email" value={profile.email} onChange={handleChange} readOnly />
                <div className="relative">
                   <InputGroup label="Date of Birth" id="dob" name="dob" type="date" value={profile.dob} onChange={handleChange} />
                </div>
                 <InputGroup label="Age" id="age" name="age" type="number" value={profile.age} onChange={handleChange} readOnly />
                <InputGroup label="Weight (kg)" id="weight" name="weight" type="number" value={profile.weight} onChange={handleChange} placeholder="Enter weight" />
                <div className="relative md:col-span-2">
                  {/* Phone verification needs UI/UX update - showing as readonly with mock button logic */}
                  <InputGroup label="Phone Number" id="phone" name="phone" type="tel" value={profile.phone} onChange={handleChange} readOnly icon={<span className="text-xs text-green-500 pr-2">Verified</span>} />
                   <button type="button" onClick={handlePhoneVerify} className="absolute right-3 top-9 text-xs bg-amber-600 hover:bg-amber-700 text-slate-900 px-2 py-0.5 rounded-full">Verify</button>
                </div>
              </div>
            </section>

            {/* Address Section */}
            <section className="mb-8">
              <h2 className={`text-lg font-semibold mb-4 border-b border-gray-700 pb-2 ${montserrat.className}`}>Address</h2>
              <div className="space-y-4">
                <InputGroup label="Address Line 1" id="address1" name="address1" value={profile.address1} onChange={handleChange} placeholder="Street address, P.O. box, etc."/>
                <InputGroup label="Address Line 2" id="address2" name="address2" value={profile.address2} onChange={handleChange} placeholder="Apartment, suite, unit, building, floor, etc."/>
              </div>
            </section>

            {/* Occupation & Income Section */}
            <section className="mb-8">
              <h2 className={`text-lg font-semibold mb-4 border-b border-gray-700 pb-2 ${montserrat.className}`}>Occupation & Income</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <InputGroup label="Occupation" id="occupation" name="occupation" value={profile.occupation} onChange={handleChange} placeholder="Your job title"/>
                <InputGroup label="Annual Income" id="income" name="income" value={profile.income} onChange={handleChange} placeholder="e.g., $50,000"/>
              </div>
            </section>

            {/* Password Change Section */}
            <section className="mb-8">
              <h2 className={`text-lg font-semibold mb-4 border-b border-gray-700 pb-2 ${montserrat.className}`}>Change Password</h2>
              <div className="space-y-4">
                <InputGroup label="Current Password" id="currentPassword" name="currentPassword" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Enter current password"/>
                <InputGroup label="New Password" id="newPassword" name="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Enter new password"/>
                <InputGroup label="Confirm New Password" id="confirmPassword" name="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm new password"/>
              </div>
            </section>

            {/* Action Buttons */}
            <section className="mt-12 border-t border-gray-700 pt-6">
              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={handleCancel}
                  className={`py-2 px-6 rounded-full font-semibold transition-colors duration-200 bg-gray-800 hover:bg-gray-700 text-slate-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-amber-500 ${montserrat.className}`} // Secondary button style
                >
                  Cancel
                </button>
                <button
                  type="button" // Changed from submit as it's not inside a form tag
                  onClick={handleSave}
                  className={`py-2 px-6 rounded-full font-semibold transition-colors duration-200 bg-amber-500 hover:bg-amber-600 text-slate-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-amber-500 ${montserrat.className}`} // Primary button style
                >
                  Save Changes
                </button>
              </div>
            </section>
          {/* </form> */}
        </div>
      </main>
    </div>
  );
}