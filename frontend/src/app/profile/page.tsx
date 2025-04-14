'use client';

import React, { useState, useEffect, ChangeEvent, FormEvent, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link'; // For navigation links
import { UserCircleIcon, CakeIcon, ArrowsUpDownIcon, TagIcon, IdentificationIcon } from '@heroicons/react/24/outline'; // Added more icons
import { Montserrat, Inter } from 'next/font/google'; // Import fonts
import axiosInstance from '@/utils/axiosInstance'; // axios 인스턴스 import 추가

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
            const response = await axiosInstance.get<UserProfile>('/api/profile/me');

            if (response.status === 401 || response.status === 403) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                router.push('/login');
                return;
            }

            const userData: UserProfile = response.data;
            setUserProfile(userData);

            if (userData && userData.id) {
                localStorage.setItem('userId', userData.id.toString());
                setCurrentUserId(userData.id);
                console.log('ProfilePage: Fetched user data and stored userId:', userData.id);
            } else {
                console.error("ProfilePage: User ID missing in fetched profile data.");
                setError('사용자 정보를 불러왔지만 ID가 없습니다. 다시 로그인해주세요.');
                setUserProfile(null);
                localStorage.removeItem('token');
                localStorage.removeItem('userId');
                router.replace('/');
                return;
            }

            setFormData({
                name: userData.name || '',
                dob: userData.dob ? userData.dob.split('T')[0] : '',
                height: userData.height?.toString() || '',
                gender: userData.gender || '',
                mbti: userData.mbti || '',
                weight: userData.weight?.toString() || '',
                phone: userData.phone || '',
                address1: userData.address1 || '',
                address2: userData.address2 || '',
                occupation: userData.occupation || '',
                income: userData.income || '',
            });

            if (!userData.gender) {
                console.log("Profile incomplete (gender missing), entering edit mode.");
                setIsEditing(true);
                alert("프로필 정보를 완성해주세요! (특히 성별)");
            }

        } catch (err: any) {
            console.error('Failed to fetch user profile (catch block):', err);
            // Authentication errors (401/403) are handled before the catch block.
            // This catch block handles other errors like network issues or server errors (5xx).
            setError(err.message || '프로필 정보 로딩 중 오류가 발생했습니다. 네트워크 연결을 확인하거나 잠시 후 다시 시도해주세요.');
            setUserProfile(null);
            // Do NOT remove token or redirect for non-authentication errors.
            // localStorage.removeItem('authToken');
            // localStorage.removeItem('userId');
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
            localStorage.setItem('token', tokenFromUrl);
            activeToken = tokenFromUrl; // Use this token immediately

            // Clean URL
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete('token');
            router.replace(newUrl.pathname + newUrl.search, { scroll: false }); // Use router.replace for cleaner URL update

        } else {
            activeToken = localStorage.getItem('token');
        }

        // Fetch profile using the determined token
        fetchUserProfile(activeToken);

    }, [searchParams, router, fetchUserProfile]); // Add fetchUserProfile to dependency array

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('userId'); // Ensure userId is also removed
        alert('로그아웃 되었습니다.');
        router.push('/'); 
    };

    // --- Handle Account Deletion --- 
    const handleDeleteAccount = async () => {
        const confirmation = window.confirm("정말로 계정을 탈퇴하시겠습니까?\n이 작업은 되돌릴 수 없으며, 매칭 및 채팅 기록에 접근할 수 없게 됩니다.");

        if (!confirmation) {
            return; // User cancelled
        }

        setIsSaving(true); // Reuse saving state for loading indicator
        setError(null);
        const token = localStorage.getItem('token');

        if (!token) {
            setError('로그인이 필요합니다.');
            alert('로그인이 필요합니다.');
            router.replace('/');
            return;
        }

        try {
            const response = await axiosInstance.delete('/api/profile/me');

            if (response.status === 204) {
                // 계정 삭제 성공
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                localStorage.removeItem('userId');
                alert('회원 탈퇴가 완료되었습니다.');
                router.push('/'); // Redirect to login page
            } else if (response.status === 401 || response.status === 403) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                localStorage.removeItem('userId');
                setError('인증에 문제가 생겼습니다. 다시 로그인해주세요.');
                alert('인증에 문제가 생겼습니다. 다시 로그인해주세요.');
                router.push('/');
            } else {
                // 기타 오류 처리
                setError(`계정 삭제 중 오류가 발생했습니다: ${response.status}`);
                alert(`계정 삭제 중 오류가 발생했습니다: ${response.status}`);
            }
        } catch (err: any) {
            console.error('Failed to delete account:', err);
            setError(err.message || '알 수 없는 오류가 발생했습니다.');
            alert(err.message || '알 수 없는 오류가 발생했습니다.');
        } finally {
            setIsSaving(false);
        }
    };
    // --------------------------------

    // Handle changes in form inputs
    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // Handle saving profile changes
    const handleSave = async (e: FormEvent) => {
        e.preventDefault();
        if (isSaving) return; // Prevent duplicate submissions
        setIsSaving(true);
        setError(null);

        // Convert string values to appropriate types before saving
        const dataToSend = {
            name: formData.name,
            dob: formData.dob || null,
            height: formData.height ? parseInt(formData.height) : null,
            gender: formData.gender || null,
            mbti: formData.mbti || null,
            weight: formData.weight ? parseInt(formData.weight) : null,
            phone: formData.phone || null,
            address1: formData.address1 || null,
            address2: formData.address2 || null,
            occupation: formData.occupation || null,
            income: formData.income || null,
        };

        try {
            const response = await axiosInstance.put('/api/profile/me', dataToSend);

            if (response.status === 200) {
                // 프로필 업데이트 성공
                const updatedUserData = response.data as UserProfile;
                setUserProfile(updatedUserData);
                setIsEditing(false);

                // 각 필드에 맞게 폼 데이터 업데이트
                setFormData({
                    name: updatedUserData.name || '',
                    dob: updatedUserData.dob ? updatedUserData.dob.split('T')[0] : '',
                    height: updatedUserData.height?.toString() || '',
                    gender: updatedUserData.gender || '',
                    mbti: updatedUserData.mbti || '',
                    weight: updatedUserData.weight?.toString() || '',
                    phone: updatedUserData.phone || '',
                    address1: updatedUserData.address1 || '',
                    address2: updatedUserData.address2 || '',
                    occupation: updatedUserData.occupation || '',
                    income: updatedUserData.income || '',
                });

                alert('프로필이 성공적으로 업데이트되었습니다.');
            } else if (response.status === 401 || response.status === 403) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                localStorage.removeItem('userId');
                setError('인증에 문제가 생겼습니다. 다시 로그인해주세요.');
                alert('인증에 문제가 생겼습니다. 다시 로그인해주세요.');
                router.push('/');
            } else {
                // 기타 오류
                setError(`프로필 업데이트 중 오류가 발생했습니다: ${response.status}`);
                alert(`프로필 업데이트 중 오류가 발생했습니다: ${response.status}`);
            }
        } catch (err: any) {
            console.error('프로필 업데이트 실패:', err);
            setError(err.message || '알 수 없는 오류가 발생했습니다.');
            alert(err.message || '알 수 없는 오류가 발생했습니다.');
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

                        <div className="flex justify-end mt-8 space-x-3">
                            <button
                                type="button"
                                onClick={handleCancel}
                                className={`px-6 py-2 rounded-full text-sm font-medium border border-slate-600 text-slate-300 hover:bg-slate-700 transition-colors ${inter.className} ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                                disabled={isSaving}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit" // Submit the form
                                disabled={isSaving}
                                className={`px-6 py-2 rounded-full text-sm font-medium bg-amber-500 hover:bg-amber-600 text-slate-900 transition-colors ${montserrat.className} font-semibold ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {isSaving ? 'Saving...' : 'Save Profile'}
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

            {/* Logout and Delete Buttons - Always visible below the form/view */}
            <div className="mt-8 pt-6 border-t border-slate-700 flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
                {/* Logout Button */}
                <button
                    onClick={handleLogout}
                    className={`w-full sm:w-auto px-6 py-2 rounded-full text-sm font-medium border border-slate-600 text-slate-300 hover:bg-slate-700 transition-colors ${inter.className}`}
                    disabled={isSaving} // Disable if saving/deleting
                >
                    Logout
                </button>

                {/* Delete Account Button */}
                <button
                    onClick={handleDeleteAccount}
                    className={`w-full sm:w-auto px-6 py-2 rounded-full text-sm font-medium border border-red-700 text-red-400 hover:bg-red-900 hover:text-red-300 transition-colors ${inter.className} ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={isSaving} // Disable if saving/deleting
                >
                    Delete Account
                </button>
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