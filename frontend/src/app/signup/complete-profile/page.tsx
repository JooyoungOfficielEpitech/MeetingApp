'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
// Import icons for consistency 
import { UserIcon, CakeIcon, ArrowsUpDownIcon, TagIcon, IdentificationIcon } from '@heroicons/react/24/outline'; 
import { Montserrat, Inter } from 'next/font/google';

// Initialize fonts (same as login page)
const montserrat = Montserrat({ subsets: ['latin'], weight: ['700', '800'] });
const inter = Inter({ subsets: ['latin'] });

export default function CompleteProfilePage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // State for pre-filled data from session
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [gender, setGender] = useState('');

    // State for user inputs
    const [age, setAge] = useState('');
    const [height, setHeight] = useState('');
    const [mbti, setMbti] = useState('');

    useEffect(() => {
        // Fetch pending profile data from backend session
        const fetchProfileData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                // Use credentials: 'include' to send session cookies
                const response = await fetch('http://localhost:3001/api/auth/session/profile-data', {
                    credentials: 'include', 
                });
                if (response.status === 401) {
                    // Unauthorized - no session or pending data
                    alert('세션 정보가 없습니다. 다시 로그인해주세요.');
                    router.replace('/'); // Redirect to login
                    return;
                }
                if (!response.ok) {
                    throw new Error('임시 프로필 정보를 가져오는데 실패했습니다.');
                }
                const data = await response.json();
                setEmail(data.email || '');
                setName(data.name || '');
                setGender(data.gender || '');
            } catch (err: any) {
                console.error("Failed to fetch profile data:", err);
                setError(err.message || '프로필 정보 로딩 중 오류 발생');
                // Optionally redirect to login on error too
                // router.replace('/'); 
            } finally {
                setIsLoading(false);
            }
        };

        fetchProfileData();
    }, [router]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        if (!name || !gender) {
            setError('Please fill in all fields.');
            setIsLoading(false);
            return;
        }

        console.log('Submitting profile completion:', { name, gender });

        try {
            const response = await fetch('http://localhost:3001/api/auth/complete-social', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name, gender }),
                credentials: 'include',
            });

            const data = await response.json();
            console.log('Response from /complete-social:', data);

            if (response.ok && data.token) {
                localStorage.setItem('authToken', data.token);
                if (data.user && data.user.id) {
                    localStorage.setItem('userId', data.user.id.toString());
                }
                if (data.user && data.user.gender) {
                    localStorage.setItem('userGender', data.user.gender);
                }
                console.log('Profile completed successfully. Token and user info stored.');
                alert('Profile completed! Redirecting to the main page.');
                router.replace('/main');
            } else {
                setError(data.message || `An error occurred: ${response.statusText}`);
            }
        } catch (err: any) {
            console.error('Failed to complete profile:', err);
            setError(err.message || 'An unexpected error occurred. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // --- Use consistent Styles --- 
    const inputBaseStyle = "w-full p-3 pl-10 rounded-full bg-slate-700 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 border border-slate-600 focus:border-amber-500 transition-colors";
    const selectBaseStyle = `${inputBaseStyle} pr-10`; // Add padding for dropdown arrow
    const labelStyle = "block text-sm font-medium text-slate-400 mb-1.5 sr-only"; // Labels hidden
    const buttonBaseStyle = "w-full py-3 px-4 rounded-full font-semibold transition-colors duration-200";
    const iconWrapperStyle = "absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none";
    // -----------------------------

    // Show loading state before data is fetched
    if (isLoading && !email) { 
        return (
             <div className={`min-h-screen bg-black text-slate-100 flex items-center justify-center ${inter.className}`}> 
                <p>Loading profile data...</p>
             </div>
        );
    }

    return (
        <div className={`min-h-screen bg-black text-slate-100 flex items-center justify-center py-16 px-4 sm:px-6 lg:px-8 ${inter.className}`}> 
            <div className="max-w-sm w-full space-y-8 bg-gray-950 p-10 rounded-2xl shadow-xl"> 
                {/* Consistent Header */}
                <div className="text-center">
                    {/* You might want a different title/icon here */}
                     <span className={`text-5xl font-bold text-amber-400 ${montserrat.className}`}>Logo</span> 
                     <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-slate-200">Complete Your Profile</h2>
                     <p className="mt-2 text-center text-sm text-slate-400">
                        Welcome, {name || 'User'}! ({email})
                     </p>
                     <p className="mt-1 text-center text-xs text-slate-500">
                        Just a few more details to get started.
                     </p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    {/* Age Input */}
                    <div>
                        <label htmlFor="age" className={labelStyle}>Age</label>
                        <div className="relative mt-1">
                             <div className={iconWrapperStyle}>
                                 <CakeIcon className="h-5 w-5 text-slate-500" aria-hidden="true" />
                             </div>
                             <input
                                id="age"
                                name="age"
                                type="number"
                                required
                                min="1"
                                className={inputBaseStyle}
                                placeholder="Age"
                                value={age}
                                onChange={(e) => setAge(e.target.value)}
                            />
                        </div>
                    </div>
                    
                    {/* Height Input */}
                    <div>
                         <label htmlFor="height" className={labelStyle}>Height (cm)</label>
                         <div className="relative mt-1">
                             <div className={iconWrapperStyle}>
                                 <ArrowsUpDownIcon className="h-5 w-5 text-slate-500" aria-hidden="true" />
                             </div>
                             <input
                                id="height"
                                name="height"
                                type="number"
                                required
                                min="1"
                                className={inputBaseStyle}
                                placeholder="Height (cm)"
                                value={height}
                                onChange={(e) => setHeight(e.target.value)}
                            />
                        </div>
                    </div>
                    
                    {/* Gender Input */}
                    <div>
                        <label htmlFor="gender" className={labelStyle}>Gender</label>
                        <div className="relative mt-1">
                             <div className={iconWrapperStyle}>
                                 {/* Choose an appropriate icon for gender */}
                                  <UserIcon className="h-5 w-5 text-slate-500" aria-hidden="true" /> 
                             </div>
                             <select
                                id="gender"
                                name="gender"
                                required
                                className={`${selectBaseStyle} appearance-none`}
                                value={gender}
                                onChange={(e) => setGender(e.target.value)}
                            >
                                <option value="" disabled>Select Gender</option>
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                                <option value="other">Other</option>
                            </select>
                             {/* Optional: Add a dropdown arrow icon absolutely positioned */}
                        </div>
                    </div>

                    {/* MBTI Input */}
                    <div>
                         <label htmlFor="mbti" className={labelStyle}>MBTI</label>
                         <div className="relative mt-1">
                             <div className={iconWrapperStyle}>
                                 <TagIcon className="h-5 w-5 text-slate-500" aria-hidden="true" />
                             </div>
                             <input
                                id="mbti"
                                name="mbti"
                                type="text"
                                required
                                maxLength={4}
                                className={`${inputBaseStyle} uppercase`}
                                placeholder="MBTI (e.g., INFP)"
                                value={mbti}
                                onChange={(e) => setMbti(e.target.value.toUpperCase())}
                            />
                        </div>
                    </div>

                    {/* Error Display */}
                    {error && (
                        <div className="text-red-400 text-sm text-center p-2 bg-red-900 bg-opacity-40 rounded-md">
                            {error}
                        </div>
                    )}

                    {/* Submit Button */}
                    <div>
                        <button
                            type="submit"
                            disabled={isLoading}
                             className={`${buttonBaseStyle} bg-amber-500 hover:bg-amber-600 text-slate-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-amber-500 ${montserrat.className} font-semibold ${isLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                            {isLoading ? 'Saving...' : 'Complete Profile'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
