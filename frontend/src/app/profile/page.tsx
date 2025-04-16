'use client';

import React, { useState, useEffect, ChangeEvent, FormEvent, Suspense, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link'; // For navigation links
import { UserCircleIcon, CakeIcon, ArrowsUpDownIcon, TagIcon, IdentificationIcon, PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline'; // Added more icons
import { Montserrat, Inter } from 'next/font/google'; // Import fonts
import axiosInstance from '@/utils/axiosInstance'; // axios 인스턴스 import 추가
import { v4 as uuidv4 } from 'uuid';

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
    profileImageUrls: string[] | null;
    businessCardImageUrl: string | null;
    createdAt: string;
    updatedAt: string;
    status: string | null;
    rejectionReason: string | null;
    nickname?: string;
    city?: string;
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
    nickname: string;
    city: string;
    // Email is usually not editable
    profileImages?: File[];
}

// Helper function to rename file with UUID
const renameFileWithUUID = (file: File): File => {
  // 파일 확장자 추출
  const fileExtension = file.name.split('.').pop() || '';
  // UUID 생성 및 확장자와 결합
  const newFileName = `${uuidv4()}.${fileExtension}`;
  
  // 새 파일 이름으로 파일 객체 생성 (타입, 내용 유지)
  return new File([file], newFileName, { type: file.type });
};

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
        occupation: '', income: '', nickname: '', city: ''
    });
    const [currentUserId, setCurrentUserId] = useState<number | null>(null);
    const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
    const [uploadedProfileImages, setUploadedProfileImages] = useState<File[]>([]);
    const [profileImagePreviews, setProfileImagePreviews] = useState<string[]>([]);
    const profileInputRef = useRef<HTMLInputElement>(null);

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
            console.log('[Profile Page] Received user data:', JSON.stringify(userData)); // 데이터 로깅 추가

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

            // ★ 첫 번째 프로필 이미지 URL 상태 설정
            if (userData.profileImageUrls && Array.isArray(userData.profileImageUrls) && userData.profileImageUrls.length > 0) {
                 console.log('[Profile Page] Setting profile image URL:', userData.profileImageUrls[0]);
                 setProfileImageUrl(userData.profileImageUrls[0]);
             } else {
                 console.log('[Profile Page] No profile image URLs found or array is empty.');
                 setProfileImageUrl(null); // 이미지가 없으면 null 설정
             }

            setFormData({
                name: userData.name || '',
                nickname: userData.nickname || '',
                city: userData.city || '',
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

            if (userData.profileImageUrls && Array.isArray(userData.profileImageUrls)) {
                setProfileImagePreviews(userData.profileImageUrls);
            }

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

    // Handle profile image upload
    const handleProfileImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            
            // 기존 파일과 합쳐서 최대 3개까지만 허용
            const combinedFiles = [...uploadedProfileImages, ...newFiles];
            if (combinedFiles.length > 3) {
                alert('프로필 사진은 최대 3장까지 업로드할 수 있습니다.');
                return;
            }
            
            // 파일 이름 UUID로 변경
            const renamedFiles = newFiles.map(file => renameFileWithUUID(file));
            const updatedFiles = [...uploadedProfileImages, ...renamedFiles];
            setUploadedProfileImages(updatedFiles);
            
            // 미리보기 URL 생성
            // 기존 미리보기 URL은 유지하고 새 이미지에 대한 미리보기만 추가
            const newPreviewUrls = newFiles.map(file => URL.createObjectURL(file));
            setProfileImagePreviews([...profileImagePreviews, ...newPreviewUrls]);
            
            // 입력 필드 초기화
            if (e.target.value) {
                e.target.value = '';
            }
        }
    };

    // Handle profile image removal
    const handleRemoveProfileImage = (index: number) => {
        // 미리보기 URL이 blob URL인 경우에만 해제
        if (profileImagePreviews[index]?.startsWith('blob:')) {
            URL.revokeObjectURL(profileImagePreviews[index]);
        }
        
        const updatedPreviews = [...profileImagePreviews];
        updatedPreviews.splice(index, 1);
        setProfileImagePreviews(updatedPreviews);
        
        const updatedFiles = [...uploadedProfileImages];
        if (index < updatedFiles.length) {
            updatedFiles.splice(index, 1);
            setUploadedProfileImages(updatedFiles);
        }
    };

    // Handle saving profile changes
    const handleSave = async (e: FormEvent) => {
        e.preventDefault();
        if (isSaving) return; // Prevent duplicate submissions
        setIsSaving(true);
        setError(null);

        // FormData 객체 생성하여 이미지와 기본 정보 함께 전송
        const formDataToSend = new FormData();
        
        // 기본 프로필 정보 추가
        formDataToSend.append('name', formData.name);
        formDataToSend.append('nickname', formData.nickname || '');
        formDataToSend.append('city', formData.city || '');
        
        if (formData.dob) formDataToSend.append('dob', formData.dob);
        if (formData.height) formDataToSend.append('height', formData.height);
        if (formData.gender) formDataToSend.append('gender', formData.gender);
        if (formData.mbti) formDataToSend.append('mbti', formData.mbti);
        if (formData.weight) formDataToSend.append('weight', formData.weight);
        if (formData.phone) formDataToSend.append('phone', formData.phone);
        if (formData.address1) formDataToSend.append('address1', formData.address1);
        if (formData.address2) formDataToSend.append('address2', formData.address2);
        if (formData.occupation) formDataToSend.append('occupation', formData.occupation);
        if (formData.income) formDataToSend.append('income', formData.income);
        
        // 새로 업로드한 프로필 이미지가 있는 경우 추가
        if (uploadedProfileImages.length > 0) {
            uploadedProfileImages.forEach(file => {
                formDataToSend.append('profilePictures', file);
            });
        }

        try {
            const response = await axiosInstance.post('/api/profile/complete-regular', formDataToSend, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            if (response.status === 200) {
                // 프로필 업데이트 성공
                const updatedUserData = (response.data as any).user || response.data as UserProfile;
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
                    nickname: updatedUserData.nickname || '',
                    city: updatedUserData.city || '',
                });
                
                // 업로드 상태 초기화
                setUploadedProfileImages([]);
                
                // 새 프로필 이미지 URL로 미리보기 업데이트
                if (updatedUserData.profileImageUrls && Array.isArray(updatedUserData.profileImageUrls)) {
                    setProfileImagePreviews(updatedUserData.profileImageUrls);
                }

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
                income: userProfile.income || '', nickname: userProfile.nickname || '', city: userProfile.city || ''
            });
        }
        setError(null);
    };

    // 거부 이유 표시 컴포넌트
    function RejectionMessage({ reason }: { reason?: string }) {
        if (!reason) return null;
        
        return (
            <div className="mb-6 p-4 bg-red-900 bg-opacity-20 rounded-lg border border-red-700">
                <h3 className="text-lg font-medium text-red-400 mb-2">프로필 승인이 거부되었습니다</h3>
                <p className="text-slate-300">{reason || '관리자에 의해 프로필이 거부되었습니다. 자세한 내용은 관리자에게 문의하세요.'}</p>
            </div>
        );
    }

    // 정지 메시지 컴포넌트
    function SuspensionMessage() {
        return (
            <div className="mb-6 p-4 bg-orange-900 bg-opacity-20 rounded-lg border border-orange-700">
                <h3 className="text-lg font-medium text-orange-400 mb-2">계정이 정지되었습니다</h3>
                <p className="text-slate-300">관리자에 의해 계정이 정지되었습니다. 자세한 내용은 관리자에게 문의하세요.</p>
            </div>
        );
    }

    // 사용자 상태 확인 로직
    const renderStatusMessage = () => {
        if (!userProfile) return null;
        
        if (userProfile.status === 'rejected') {
            return <RejectionMessage reason={userProfile.rejectionReason || undefined} />;
        }
        
        if (userProfile.status === 'suspended') {
            return <SuspensionMessage />;
        }
        
        return null;
    };

    // 컴포넌트 언마운트 시 미리보기 URL 정리
    useEffect(() => {
        return () => {
            // 로컬 blob URL만 해제
            profileImagePreviews.forEach(url => {
                if (url.startsWith('blob:')) {
                    URL.revokeObjectURL(url);
                }
            });
        };
    }, [profileImagePreviews]);

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

                {/* 상태 메시지 표시 */}
                {renderStatusMessage()}

                {/* 프로필 이미지 표시 (3개 이미지) */}
                <div className="mb-8">
                    <h2 className="text-xl font-semibold text-amber-400 mb-3">프로필 이미지</h2>
                    <div className="flex flex-col items-center">
                        {/* 메인 이미지 (크게) */}
                        <div className="w-48 h-48 rounded-xl bg-gray-700 border-4 border-amber-500 flex items-center justify-center overflow-hidden mb-4">
                            {userProfile?.profileImageUrls && userProfile.profileImageUrls.length > 0 ? (
                                <img 
                                    src={userProfile.profileImageUrls[0]} 
                                    alt="Main Profile" 
                                    className="w-full h-full object-cover"
                                    onError={(e) => (e.currentTarget.src = '/default-avatar.png')}
                                />
                            ) : (
                                <UserCircleIcon className="h-32 w-32 text-slate-500" />
                            )}
                        </div>
                        
                        {/* 보조 이미지들 (작게) */}
                        <div className="flex space-x-4">
                            {userProfile?.profileImageUrls && userProfile.profileImageUrls.length > 1 ? (
                                <>
                                    <div className="w-24 h-24 rounded-lg bg-gray-700 border-2 border-amber-400 flex items-center justify-center overflow-hidden">
                                        <img 
                                            src={userProfile.profileImageUrls[1]} 
                                            alt="Profile 2" 
                                            className="w-full h-full object-cover"
                                            onError={(e) => (e.currentTarget.src = '/default-avatar.png')}
                                        />
                                    </div>
                                    
                                    {userProfile.profileImageUrls.length > 2 && (
                                        <div className="w-24 h-24 rounded-lg bg-gray-700 border-2 border-amber-400 flex items-center justify-center overflow-hidden">
                                            <img 
                                                src={userProfile.profileImageUrls[2]} 
                                                alt="Profile 3" 
                                                className="w-full h-full object-cover"
                                                onError={(e) => (e.currentTarget.src = '/default-avatar.png')}
                                            />
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="text-slate-400 text-sm">추가 프로필 이미지가 없습니다</div>
                            )}
                        </div>
                    </div>
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
                        <div>
                            <label htmlFor="nickname" className={labelStyle}>Nickname</label>
                            <div className="relative mt-1">
                                <div className={iconWrapperStyle}><UserCircleIcon className="h-5 w-5 text-slate-500"/></div>
                                <input id="nickname" name="nickname" type="text" required value={formData.nickname || ''} onChange={handleChange} className={inputBaseStyle} placeholder="Nickname"/>
                            </div>
                        </div>
                        <div>
                            <label htmlFor="city" className={labelStyle}>City</label>
                            <div className="relative mt-1">
                                <div className={iconWrapperStyle}><IdentificationIcon className="h-5 w-5 text-slate-500"/></div>
                                <select id="city" name="city" value={formData.city || ''} onChange={handleChange} className={selectBaseStyle}>
                                    <option value="" disabled>Select City</option>
                                    <option value="seoul">Seoul</option>
                                    <option value="busan">Busan</option>
                                    <option value="jeju">Jeju</option>
                                </select>
                            </div>
                        </div>

                        {error && (
                             <div className="text-red-400 text-sm text-center p-2 bg-red-900 bg-opacity-40 rounded-md">
                                {error}
                             </div>
                        )}

                        <div className="mt-8">
                            <label htmlFor="profile-images" className="block text-lg font-medium text-amber-400 mb-3">프로필 사진 (최대 3장)</label>
                            <div className="grid grid-cols-3 gap-4 mb-4">
                                {profileImagePreviews.map((preview, index) => (
                                    <div key={index} className="relative rounded-lg overflow-hidden h-32 bg-gray-700">
                                        <img 
                                            src={preview} 
                                            alt={`프로필 ${index+1}`} 
                                            className="w-full h-full object-cover"
                                            onError={(e) => (e.currentTarget.src = '/default-avatar.png')}
                                        />
                                        <button 
                                            type="button"
                                            onClick={() => handleRemoveProfileImage(index)}
                                            className="absolute top-2 right-2 bg-red-600 rounded-full p-1 text-white hover:bg-red-700"
                                        >
                                            <XMarkIcon className="h-5 w-5" />
                                        </button>
                                        {index === 0 && (
                                            <div className="absolute bottom-0 left-0 right-0 bg-amber-600 text-white text-xs text-center py-1">
                                                메인 사진
                                            </div>
                                        )}
                                    </div>
                                ))}
                                
                                {/* 빈 슬롯 표시 */}
                                {Array.from({ length: Math.max(0, 3 - profileImagePreviews.length) }).map((_, index) => (
                                    <div key={`empty-${index}`} className="h-32 rounded-lg border-2 border-dashed border-gray-500 flex items-center justify-center bg-gray-800">
                                        <div className="text-gray-400 text-center">
                                            <PhotoIcon className="h-8 w-8 mx-auto mb-1" />
                                            <span className="text-xs">비어있음</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            
                            <input
                                ref={profileInputRef}
                                id="profile-images"
                                type="file"
                                accept="image/*"
                                multiple
                                className="sr-only" // 화면에 보이지 않게
                                onChange={handleProfileImageUpload}
                            />
                            
                            <button
                                type="button"
                                onClick={() => profileInputRef.current?.click()}
                                className="mt-2 py-2 px-4 bg-gray-700 rounded-md text-white hover:bg-gray-600 flex items-center justify-center w-full"
                                disabled={profileImagePreviews.length >= 3}
                            >
                                <PhotoIcon className="h-5 w-5 mr-2" />
                                {profileImagePreviews.length === 0 ? '프로필 사진 추가' : '사진 추가하기'} 
                                {profileImagePreviews.length >= 3 && ' (최대 3장)'}
                            </button>
                            
                            <p className="text-sm text-gray-400 mt-2">
                                * 첫 번째 사진이 메인 프로필 사진으로 사용됩니다.
                            </p>
                        </div>

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
                    <div className="space-y-6">
                        {/* 중요 정보 세션 - 요청에 따른 강조 정보들 */}
                        <div className="p-4 bg-gray-900 rounded-xl">
                            <h2 className="text-xl font-semibold text-amber-400 mb-3">기본 정보</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-gray-800 p-3 rounded-lg">
                                    <span className={`${labelStyle} text-amber-300`}>아이디</span>
                                    <p className={`${valueStyle} text-xl`}>#{userProfile?.id ?? '-'}</p>
                                </div>
                                <div className="bg-gray-800 p-3 rounded-lg">
                                    <span className={`${labelStyle} text-amber-300`}>이메일</span>
                                    <p className={`${valueStyle} text-xl`}>{userProfile?.email ?? '-'}</p>
                                </div>
                                <div className="bg-gray-800 p-3 rounded-lg">
                                    <span className={`${labelStyle} text-amber-300`}>성별</span>
                                    <p className={`${valueStyle} text-xl`}>{userProfile?.gender === 'male' ? '남성' : userProfile?.gender === 'female' ? '여성' : '-'}</p>
                                </div>
                                <div className="bg-gray-800 p-3 rounded-lg">
                                    <span className={`${labelStyle} text-amber-300`}>사는 곳</span>
                                    <p className={`${valueStyle} text-xl`}>{
                                        userProfile?.city === 'seoul' ? '서울' : 
                                        userProfile?.city === 'busan' ? '부산' : 
                                        userProfile?.city === 'jeju' ? '제주' : '-'
                                    }</p>
                                </div>
                            </div>
                        </div>
                        
                        {/* 추가 정보 섹션 */}
                        <div className="p-4 bg-gray-900 rounded-xl">
                            <h2 className="text-xl font-semibold text-amber-400 mb-3">추가 정보</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div><span className={labelStyle}>이름</span><p className={valueStyle}>{userProfile?.name ?? '-'}</p></div>
                                <div><span className={labelStyle}>닉네임</span><p className={valueStyle}>{userProfile?.nickname ?? '-'}</p></div>
                                <div><span className={labelStyle}>나이</span><p className={valueStyle}>{userProfile?.age ?? '-'}</p></div>
                                <div><span className={labelStyle}>키</span><p className={valueStyle}>{userProfile?.height ? `${userProfile.height} cm` : '-'}</p></div>
                                <div><span className={labelStyle}>MBTI</span><p className={valueStyle}>{userProfile?.mbti ?? '-'}</p></div>
                                <div><span className={labelStyle}>생일</span><p className={valueStyle}>{userProfile?.dob ? new Date(userProfile.dob).toLocaleDateString() : '-'}</p></div>
                                <div><span className={labelStyle}>몸무게</span><p className={valueStyle}>{userProfile?.weight ? `${userProfile.weight} kg` : '-'}</p></div>
                                <div><span className={labelStyle}>전화번호</span><p className={valueStyle}>{userProfile?.phone ?? '-'}</p></div>
                                <div><span className={labelStyle}>주소 1</span><p className={valueStyle}>{userProfile?.address1 ?? '-'}</p></div>
                                <div><span className={labelStyle}>주소 2</span><p className={valueStyle}>{userProfile?.address2 ?? '-'}</p></div>
                                <div><span className={labelStyle}>직업</span><p className={valueStyle}>{userProfile?.occupation ?? '-'}</p></div>
                                <div><span className={labelStyle}>수입</span><p className={valueStyle}>{userProfile?.income ?? '-'}</p></div>
                            </div>
                        </div>
                        
                        <div className="border-t border-slate-700 pt-6 flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
                            <button 
                                onClick={() => setIsEditing(true)}
                                className={`${buttonBaseStyle} bg-amber-500 hover:bg-amber-600 text-slate-900 w-full sm:w-auto`}
                            >
                                프로필 수정하기
                            </button>
                            <button 
                                onClick={handleDeleteAccount}
                                className={`${buttonBaseStyle} bg-red-800 hover:bg-red-700 text-slate-200 text-sm w-full sm:w-auto`}
                                disabled={isSaving}
                            >
                                {isSaving ? '삭제 중...' : '계정 삭제하기'}
                            </button>
                        </div>
                    </div>
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