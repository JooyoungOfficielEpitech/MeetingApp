'use client';

import React, { useState, useEffect, ChangeEvent, FormEvent, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link'; // For navigation links
import { UserCircleIcon, CakeIcon, ArrowsUpDownIcon, TagIcon, IdentificationIcon } from '@heroicons/react/24/outline'; // Added more icons
import { Montserrat, Inter } from 'next/font/google'; // Import fonts

const inter = Inter({ subsets: ['latin'] });
const montserrat = Montserrat({ subsets: ['latin'], weight: ['700', '800'] }); // Make sure font is initialized

// Define an interface for the user profile data (adjust based on your User model)
interface UserProfile {
    id: number;
    email: string;
    name: string;
    dob: string | null;
    age: number | null;
    height: number | null;
    gender: string | null;
    mbti: string | null;
    weight: number | null;
    phone: string | null;
    address1: string | null;
    address2: string | null;
    occupation: string | null;
    income: string | null;
    profilePictureUrl: string | null;
    createdAt: string;
    updatedAt: string;
    // Add other fields as needed
}

// Interface for form data (subset of UserProfile, some might be string for input)
interface ProfileFormData {
    name: string;
    dob: string; // Use string for date input
    height: string; // Use string for number input
    gender: string;
    mbti: string;
    weight: string; // Use string for number input
    phone: string;
    address1: string;
    address2: string;
    occupation: string;
    income: string;
    // Email is usually not editable
}

// --- Inner component using hooks ---
function ProfileContent() {
    const router = useRouter();
    const searchParams = useSearchParams(); // Get search params
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState<ProfileFormData>({
        name: '', dob: '', height: '', gender: '', mbti: '',
        weight: '', phone: '', address1: '', address2: '',
        occupation: '', income: ''
    });
    const [currentUserId, setCurrentUserId] = useState<number | null>(null);

    // --- Wrap fetchUserProfile in useCallback ---
    const fetchUserProfile = useCallback(async (token: string | null) => {
        if (!token) {
            setError('로그인이 필요합니다. 로그인 페이지로 이동합니다.');
            alert('로그인이 필요합니다. 로그인 페이지로 이동합니다.');
            router.replace('/'); // Redirect to login
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch('http://localhost:3001/api/users/me', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            if (response.status === 401 || response.status === 403) {
                localStorage.removeItem('authToken');
                localStorage.removeItem('userInfo');
                setError('인증이 만료되었거나 유효하지 않습니다. 다시 로그인해주세요.');
                alert('인증이 만료되었거나 유효하지 않습니다. 다시 로그인해주세요.');
                router.replace('/');
                return;
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: '프로필 정보를 가져오는데 실패했습니다.' }));
                throw new Error(errorData.message || '프로필 정보를 가져오는데 실패했습니다.');
            }

            const data: UserProfile = await response.json();
            setUserProfile(data);

            // --- Store userId from fetched profile data --- 
            if (data && data.id) {
                localStorage.setItem('userId', data.id.toString());
                setCurrentUserId(data.id); // Update state immediately if needed elsewhere
                console.log('ProfilePage: Fetched user data and stored userId:', data.id);
            } else {
                 console.error("ProfilePage: User ID missing in fetched profile data.");
                 // Handle this critical error, maybe redirect to login
                 setError('사용자 정보를 불러왔지만 ID가 없습니다. 다시 로그인해주세요.');
                 // Consider clearing potentially partial state
                 setUserProfile(null);
                 localStorage.removeItem('authToken');
                 localStorage.removeItem('userId');
                 router.replace('/');
                 return; // Stop further processing
            }
            // -----------------------------------------------

            // Initialize form data
            setFormData({
                name: data.name || '',
                dob: data.dob ? data.dob.split('T')[0] : '', // Format date for input type="date"
                height: data.height?.toString() || '',
                gender: data.gender || '',
                mbti: data.mbti || '',
                weight: data.weight?.toString() || '',
                phone: data.phone || '',
                address1: data.address1 || '',
                address2: data.address2 || '',
                occupation: data.occupation || '',
                income: data.income || '',
            });

             // Automatically enable editing if profile seems incomplete
             if (!data.gender) {
                 console.log("Profile incomplete (gender missing), entering edit mode.");
                 setIsEditing(true);
                 // Optionally show a message encouraging completion
                 alert("프로필 정보를 완성해주세요! (특히 성별)");
             }
             // --- ---

        } catch (err: any) {
            console.error('Failed to fetch user profile:', err);
            setError(err.message || '프로필 정보 로딩 중 오류 발생');
        } finally {
            setIsLoading(false);
        }
    }, [router]);

    // --- Effect for handling token and initial fetch ---
    useEffect(() => {
        const tokenFromUrl = searchParams.get('token');
        let activeToken: string | null = null;

        if (tokenFromUrl) {
            console.log('ProfilePage: Token found in URL, saving to localStorage.');
            localStorage.setItem('authToken', tokenFromUrl);
            activeToken = tokenFromUrl; // Use this token immediately

            // Clean URL
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete('token');
            router.replace(newUrl.pathname + newUrl.search, { scroll: false }); // Use router.replace for cleaner URL update

        } else {
            activeToken = localStorage.getItem('authToken');
        }

        // Fetch profile using the determined token
        fetchUserProfile(activeToken);

    }, [searchParams, router, fetchUserProfile]); // Add fetchUserProfile to dependency array

    const handleLogout = () => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userInfo');
        alert('로그아웃 되었습니다.');
        router.push('/'); 
    };

    // Handle changes in form inputs
    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // Handle saving profile changes
    const handleSave = async (e: FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setError(null);
        const token = localStorage.getItem('authToken');

        if (!token) {
            setError('로그인이 필요합니다. 로그인 페이지로 이동합니다.');
            alert('로그인이 필요합니다. 로그인 페이지로 이동합니다.');
            router.replace('/');
            return;
        }

        const dataToSend = {
            name: formData.name || null, // Send null if empty? Or handle validation
            dob: formData.dob || null,
            height: formData.height ? parseInt(formData.height, 10) : null,
            gender: formData.gender || null,
            mbti: formData.mbti ? formData.mbti.toUpperCase() : null,
            weight: formData.weight ? parseFloat(formData.weight) : null,
            phone: formData.phone || null,
            address1: formData.address1 || null,
            address2: formData.address2 || null,
            occupation: formData.occupation || null,
            income: formData.income || null,
        };

        try {
            const response = await fetch('http://localhost:3001/api/users/me', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(dataToSend),
            });

             if (response.status === 401 || response.status === 403) {
                 localStorage.removeItem('authToken');
                 localStorage.removeItem('userInfo');
                 setError('인증이 만료되었거나 유효하지 않습니다. 다시 로그인해주세요.');
                 alert('인증이 만료되었거나 유효하지 않습니다. 다시 로그인해주세요.');
                 router.replace('/');
                 // Explicitly return here after handling auth error to avoid further processing
                 return; 
             }

            // Check response status first
            if (!response.ok) {
                let errorMessage = 'Failed to update profile';
                try {
                    // Try to parse error response as JSON
                    const errorData = await response.json();
                    if (errorData && errorData.message) {
                        errorMessage = errorData.message;
                    } else if (errorData && Array.isArray(errorData.errors)) {
                        errorMessage = errorData.errors.map((e: any) => e.msg).join(', ');
                    }
                } catch (jsonError) {
                    // If JSON parsing fails, try to get text response
                    try {
                        errorMessage = await response.text();
                    } catch (textError) {
                         // Keep default message if text parsing also fails
                        console.error("Could not parse error response body:", textError);
                    }
                }
                 // Throw error after processing the response body
                throw new Error(errorMessage);
            }

            // If response.ok is true, parse the successful response
            const updatedUserProfile: UserProfile = await response.json();

            // --- Update local profile state with the direct response data --- 
            setUserProfile(updatedUserProfile);
            // --------------------------------------------------------------
            setIsEditing(false);
            alert('프로필이 성공적으로 업데이트되었습니다!');


        } catch (err: any) {
            console.error('Failed to save profile:', err);
            setError(err.message || '프로필 저장 중 오류 발생');
        } finally {
            setIsSaving(false);
        }
    };

    // Handle cancelling edit mode
    const handleCancel = () => {
        setIsEditing(false);
        if (userProfile) {
            setFormData({
                name: userProfile.name || '', dob: userProfile.dob ? userProfile.dob.split('T')[0] : '',
                height: userProfile.height?.toString() || '', gender: userProfile.gender || '',
                mbti: userProfile.mbti || '', weight: userProfile.weight?.toString() || '',
                phone: userProfile.phone || '', address1: userProfile.address1 || '',
                address2: userProfile.address2 || '', occupation: userProfile.occupation || '',
                income: userProfile.income || ''
            });
        }
        setError(null);
    };

    if (isLoading) {
        return (
             <div className={`min-h-screen bg-black text-slate-100 flex items-center justify-center ${inter.className}`}>
                <p>프로필 로딩 중...</p>
             </div>
        );
    }

    if (error && !isEditing && !userProfile) {
         return (
             <div className={`min-h-screen bg-black text-slate-100 flex flex-col items-center justify-center ${inter.className}`}>
                <p className="text-red-500 mb-4">오류: {error}</p>
                <button onClick={() => router.push('/')} className="mt-2 text-amber-400 underline">로그인 페이지로 이동</button>
             </div>
        );
    }
    
    if (!userProfile) {
         return (
             <div className={`min-h-screen bg-black text-slate-100 flex flex-col items-center justify-center ${inter.className}`}>
                <p>프로필 데이터를 불러올 수 없습니다.</p>
                 <button onClick={() => router.push('/')} className="mt-2 text-amber-400 underline">로그인 페이지로 이동</button>
             </div>
        );
    }

    const cardStyle = "max-w-xl w-full space-y-6 bg-gray-950 p-8 md:p-10 rounded-2xl shadow-xl";
    const headingStyle = `text-3xl font-bold text-amber-400 ${montserrat.className}`;
    const labelStyle = "block text-sm font-medium text-slate-400";
    const valueStyle = "mt-1 text-lg text-slate-100 break-words";
    const inputBaseStyle = "w-full p-3 pl-10 rounded-full bg-slate-700 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 border border-slate-600 focus:border-amber-500 transition-colors";
    const selectBaseStyle = `${inputBaseStyle} pr-10 appearance-none`;
    const buttonBaseStyle = "py-2 px-4 rounded-full font-semibold transition-colors duration-200";
    const iconWrapperStyle = "absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none";

    return (
        <div className={`min-h-screen bg-black text-slate-100 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 ${inter.className}`}>
            <div className={cardStyle}>
                <div className="flex justify-between items-center mb-6">
                    <h1 className={headingStyle}>{isEditing ? 'Edit Profile' : 'My Profile'}</h1>
                    {!isEditing && (
                         <button 
                            onClick={handleLogout}
                            className={`${buttonBaseStyle} bg-red-600 hover:bg-red-700 text-white text-sm ml-4`}
                         >
                             Logout
                         </button>
                    )}
                </div>

                {isEditing ? (
                    <form onSubmit={handleSave} className="space-y-4">
                        <div>
                            <label htmlFor="name" className={labelStyle}>Name</label>
                             <div className="relative mt-1">
                                <div className={iconWrapperStyle}><UserCircleIcon className="h-5 w-5 text-slate-500"/></div>
                                <input id="name" name="name" type="text" required value={formData.name} onChange={handleChange} className={inputBaseStyle} placeholder="Name"/>
                            </div>
                        </div>
                        <div>
                            <label htmlFor="dob" className={labelStyle}>Date of Birth</label>
                             <div className="relative mt-1">
                                <div className={iconWrapperStyle}><CakeIcon className="h-5 w-5 text-slate-500"/></div>
                                <input id="dob" name="dob" type="date" value={formData.dob} onChange={handleChange} className={inputBaseStyle} placeholder="YYYY-MM-DD"/>
                             </div>
                        </div>
                        <div>
                            <label htmlFor="height" className={labelStyle}>Height (cm)</label>
                             <div className="relative mt-1">
                                <div className={iconWrapperStyle}><ArrowsUpDownIcon className="h-5 w-5 text-slate-500"/></div>
                                <input id="height" name="height" type="number" value={formData.height} onChange={handleChange} className={inputBaseStyle} placeholder="Height (cm)"/>
                             </div>
                        </div>
                        <div>
                            <label htmlFor="gender" className={labelStyle}>Gender</label>
                            <div className="relative mt-1">
                                <div className={iconWrapperStyle}><IdentificationIcon className="h-5 w-5 text-slate-500"/></div>
                                <select id="gender" name="gender" value={formData.gender} onChange={handleChange} className={selectBaseStyle}>
                                    <option value="" disabled>Select Gender</option>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label htmlFor="mbti" className={labelStyle}>MBTI</label>
                             <div className="relative mt-1">
                                <div className={iconWrapperStyle}><TagIcon className="h-5 w-5 text-slate-500"/></div>
                                <input id="mbti" name="mbti" type="text" maxLength={4} value={formData.mbti} onChange={handleChange} className={`${inputBaseStyle} uppercase`} placeholder="MBTI"/>
                            </div>
                        </div>
                        <div>
                            <label htmlFor="weight" className={labelStyle}>Weight (kg)</label>
                             <div className="relative mt-1">
                                <div className={iconWrapperStyle}><IdentificationIcon className="h-5 w-5 text-slate-500"/></div>
                                <input id="weight" name="weight" type="number" step="0.1" value={formData.weight} onChange={handleChange} className={inputBaseStyle} placeholder="Weight (kg)"/>
                             </div>
                        </div>
                        <div>
                            <label htmlFor="phone" className={labelStyle}>Phone</label>
                             <div className="relative mt-1">
                                <div className={iconWrapperStyle}><IdentificationIcon className="h-5 w-5 text-slate-500"/></div>
                                <input id="phone" name="phone" type="tel" value={formData.phone} onChange={handleChange} className={inputBaseStyle} placeholder="Phone"/>
                            </div>
                        </div>
                        <div>
                            <label htmlFor="address1" className={labelStyle}>Address Line 1</label>
                            <div className="relative mt-1">
                                <div className={iconWrapperStyle}><IdentificationIcon className="h-5 w-5 text-slate-500"/></div>
                                <input id="address1" name="address1" type="text" value={formData.address1} onChange={handleChange} className={inputBaseStyle} placeholder="Address Line 1"/>
                            </div>
                        </div>
                        <div>
                            <label htmlFor="address2" className={labelStyle}>Address Line 2</label>
                             <div className="relative mt-1">
                                <div className={iconWrapperStyle}><IdentificationIcon className="h-5 w-5 text-slate-500"/></div>
                                <input id="address2" name="address2" type="text" value={formData.address2} onChange={handleChange} className={inputBaseStyle} placeholder="Address Line 2"/>
                             </div>
                        </div>
                        <div>
                            <label htmlFor="occupation" className={labelStyle}>Occupation</label>
                             <div className="relative mt-1">
                                <div className={iconWrapperStyle}><IdentificationIcon className="h-5 w-5 text-slate-500"/></div>
                                <input id="occupation" name="occupation" type="text" value={formData.occupation} onChange={handleChange} className={inputBaseStyle} placeholder="Occupation"/>
                             </div>
                        </div>
                        <div>
                            <label htmlFor="income" className={labelStyle}>Income</label>
                             <div className="relative mt-1">
                                <div className={iconWrapperStyle}><IdentificationIcon className="h-5 w-5 text-slate-500"/></div>
                                <input id="income" name="income" type="text" value={formData.income} onChange={handleChange} className={inputBaseStyle} placeholder="Income"/>
                            </div>
                        </div>

                        {error && (
                             <div className="text-red-400 text-sm text-center p-2 bg-red-900 bg-opacity-40 rounded-md">
                                {error}
                             </div>
                        )}

                        <div className="flex justify-end space-x-3 pt-4">
                            <button type="button" onClick={handleCancel} disabled={isSaving}
                                className={`${buttonBaseStyle} bg-slate-600 hover:bg-slate-700 text-slate-100 ${isSaving ? 'opacity-50' : ''}`}>
                                Cancel
                            </button>
                            <button type="submit" disabled={isSaving}
                                className={`${buttonBaseStyle} bg-amber-500 hover:bg-amber-600 text-slate-900 ${montserrat.className} font-semibold ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                {isSaving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </form>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div><span className={labelStyle}>Name</span><p className={valueStyle}>{userProfile?.name}</p></div>
                            <div><span className={labelStyle}>Email</span><p className={valueStyle}>{userProfile?.email}</p></div>
                            <div><span className={labelStyle}>Age</span><p className={valueStyle}>{userProfile?.age ?? '-'}</p></div>
                            <div><span className={labelStyle}>Height</span><p className={valueStyle}>{userProfile?.height ? `${userProfile.height} cm` : '-'}</p></div>
                            <div><span className={labelStyle}>Gender</span><p className={valueStyle}>{userProfile?.gender ?? '-'}</p></div>
                            <div><span className={labelStyle}>MBTI</span><p className={valueStyle}>{userProfile?.mbti ?? '-'}</p></div>
                            <div><span className={labelStyle}>Date of Birth</span><p className={valueStyle}>{userProfile?.dob ?? '-'}</p></div>
                            <div><span className={labelStyle}>Weight</span><p className={valueStyle}>{userProfile?.weight ? `${userProfile.weight} kg` : '-'}</p></div>
                            <div><span className={labelStyle}>Phone</span><p className={valueStyle}>{userProfile?.phone ?? '-'}</p></div>
                            <div><span className={labelStyle}>Address Line 1</span><p className={valueStyle}>{userProfile?.address1 ?? '-'}</p></div>
                            <div><span className={labelStyle}>Address Line 2</span><p className={valueStyle}>{userProfile?.address2 ?? '-'}</p></div>
                            <div><span className={labelStyle}>Occupation</span><p className={valueStyle}>{userProfile?.occupation ?? '-'}</p></div>
                            <div><span className={labelStyle}>Income</span><p className={valueStyle}>{userProfile?.income ?? '-'}</p></div>
                        </div>
                        <div className="mt-8 text-right">
                            <button 
                                onClick={() => { setIsEditing(true); setError(null); }}
                                className={`${buttonBaseStyle} bg-amber-500 hover:bg-amber-600 text-slate-900 ${montserrat.className} font-semibold`}
                             >
                                Edit Profile
                            </button>
                        </div>
                    </>
                )}
            </div>
            
            <div className="mt-6">
                <Link href="/main" className="text-sm text-amber-400 hover:text-amber-300">
                    &larr; Back to Main
                </Link>
            </div>
        </div>
    );
}

// --- Export with Suspense ---
export default function ProfilePage() {
    return (
        <Suspense fallback={
             <div className={`min-h-screen bg-black text-slate-100 flex items-center justify-center ${inter.className}`}>
                 <p>Loading profile...</p>
             </div>
        }>
            <ProfileContent />
        </Suspense>
    );
}