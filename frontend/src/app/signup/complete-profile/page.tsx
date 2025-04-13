'use client';

import React, { useState, useEffect, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
// Import icons for consistency 
import { UserIcon, CakeIcon, ArrowsUpDownIcon, TagIcon, PhotoIcon, IdentificationIcon as BusinessCardIcon, XMarkIcon } from '@heroicons/react/24/outline'; 
import { Montserrat, Inter } from 'next/font/google';
// Import axiosInstance
import axiosInstance from '@/utils/axiosInstance'; // Ensure this path is correct for your project structure
// --- axios import 추가 ---
import axios from 'axios'; // Assuming standard axios is available
// -----------------------

// Initialize fonts (same as login page)
const montserrat = Montserrat({ subsets: ['latin'], weight: ['700', '800'] });
const inter = Inter({ subsets: ['latin'] });

// Define interfaces for API response data types
interface UserData {
    id: number | string;
    gender: string;
    status?: string; // Add optional status field
    // Add other user fields if present in the response
}

interface ProfileDataResponse {
    email?: string;
    name?: string;
    gender?: string;
    // Add other fields if your session endpoint returns more
}

interface CompleteSocialResponse {
    token: string;
    user: UserData;
    message?: string; // Optional error/success message
}

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

    // Add state for files and previews
    const [profilePictures, setProfilePictures] = useState<File[]>([]);
    const [businessCard, setBusinessCard] = useState<File | null>(null);
    const [profilePicturePreviews, setProfilePicturePreviews] = useState<string[]>([]);
    const [businessCardPreview, setBusinessCardPreview] = useState<string | null>(null);

    useEffect(() => {
        // Fetch temporary profile data from session
        const fetchSessionData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                // Use a standard axios instance or configure axiosInstance to NOT send token for this request
                // Assuming standard axios for session endpoint
                const response = await axios.get<ProfileDataResponse>(
                    'http://localhost:3001/api/auth/session/profile-data', // ★ 백엔드 전체 URL 명시
                    { withCredentials: true } // ★ 세션 쿠키 전송 옵션 추가
                ); 

                const data = response.data;
                console.log('[Complete Profile] Fetched session profile data:', data);

                // --- 세션 데이터 유효성 검사 및 상태 설정 ---
                if (!data || !data.email) { // 이메일은 필수값이라고 가정
                    console.error('[Complete Profile] Invalid or missing session data.');
                    setError('세션 정보가 유효하지 않습니다. 다시 Google 로그인을 시도해주세요.');
                     // 세션 데이터 없으면 진행 불가, 로그인 페이지로 리디렉션
                    router.replace('/');
                    return;
                }
                // ---------------------------------------

                setEmail(data.email || '');
                setName(data.name || '');
                setGender(data.gender || ''); // 세션에 성별 정보가 있다면 미리 채움

            } catch (err: any) {
                console.error("Failed to fetch session profile data:", err);
                let errorMessage = '임시 프로필 정보를 불러오는 중 오류가 발생했습니다.';
                if (err.response?.status === 401) {
                    // 세션이 없거나 만료된 경우
                    errorMessage = '세션이 만료되었거나 유효하지 않습니다. 다시 Google 로그인을 시도해주세요.';
                    router.replace('/'); // 로그인 페이지로 리디렉션
                    return;
                } else if (err.response) {
                    errorMessage = err.response.data?.message || `세션 데이터 로딩 실패 (Status: ${err.response.status})`;
                } else if (err.request) {
                   errorMessage = '서버 연결 실패. 네트워크를 확인해주세요.';
                } else {
                    errorMessage = err.message || errorMessage;
                }
                setError(errorMessage);
                // 오류 발생 시 로딩 상태는 false로 유지
            } finally {
                setIsLoading(false);
            }
        };

        // 페이지 로드 시 세션 데이터 가져오기 실행
        fetchSessionData();

    }, [router]);

    // Handler for profile picture selection
    const handleProfilePictureChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            const existingFiles = profilePictures; // Get current files from state

            // Combine existing and new files
            const combinedFiles = [...existingFiles, ...newFiles];

            // Check total count
            if (combinedFiles.length > 3) {
                alert(`프로필 사진은 최대 3장까지 업로드할 수 있습니다. 현재 ${existingFiles.length}장 선택되어 있습니다.`);
                e.target.value = ''; // Clear the input to allow re-selection if needed
                return; // Do not update state if limit exceeded
            }

            // Update state with the combined list
            setProfilePictures(combinedFiles);

            // Generate previews for the combined list
            // Clean up *all* previous preview URLs first
            profilePicturePreviews.forEach(url => URL.revokeObjectURL(url));
            const newPreviewUrls = combinedFiles.map(file => URL.createObjectURL(file));
            setProfilePicturePreviews(newPreviewUrls);

            // Clear the file input value after processing to allow selecting the same file again later if needed
            e.target.value = ''; 
        }
    };

    // Handler for business card selection
    const handleBusinessCardChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setBusinessCard(file);

            // Generate preview
            const newPreviewUrl = URL.createObjectURL(file);
            // Clean up old preview before setting new one
            if (businessCardPreview) {
                URL.revokeObjectURL(businessCardPreview);
            }
            setBusinessCardPreview(newPreviewUrl);
        } else {
             // Handle case where file selection is cancelled or empty
             setBusinessCard(null);
             if (businessCardPreview) {
                 URL.revokeObjectURL(businessCardPreview);
             }
             setBusinessCardPreview(null);
             e.target.value = ''; // Clear the input value
        }
    };

    // --- Handlers to remove images ---
    const handleRemoveProfilePicture = (indexToRemove: number) => {
        // Remove the file
        const updatedFiles = profilePictures.filter((_, index) => index !== indexToRemove);
        setProfilePictures(updatedFiles);

        // Remove the preview and revoke URL
        const urlToRemove = profilePicturePreviews[indexToRemove];
        if (urlToRemove) {
            URL.revokeObjectURL(urlToRemove);
        }
        const updatedPreviews = profilePicturePreviews.filter((_, index) => index !== indexToRemove);
        setProfilePicturePreviews(updatedPreviews);
    };

    const handleRemoveBusinessCard = () => {
        setBusinessCard(null);
        if (businessCardPreview) {
            URL.revokeObjectURL(businessCardPreview);
            setBusinessCardPreview(null);
        }
        // Optionally clear the file input
        const input = document.getElementById('businessCard') as HTMLInputElement;
        if (input) input.value = '';
    };
    // --- End Handlers to remove images ---

    // Cleanup previews on component unmount
    useEffect(() => {
        return () => {
            profilePicturePreviews.forEach(url => URL.revokeObjectURL(url));
            if (businessCardPreview) {
                URL.revokeObjectURL(businessCardPreview);
            }
        };
    }, [profilePicturePreviews, businessCardPreview]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        // --- Validation ---
        if (!age || !height || !gender || !mbti) {
            setError('모든 필수 정보를 입력해주세요.');
            setIsLoading(false);
            return;
        }
        if (profilePictures.length === 0) {
            setError('프로필 사진을 최소 1장 이상 등록해주세요.');
            setIsLoading(false);
            return;
        }
         if (profilePictures.length > 3) {
            setError('프로필 사진은 최대 3장까지 가능합니다.');
            setIsLoading(false);
            return;
        }
         if (!businessCard) {
            setError('명함 사진을 등록해주세요.');
            setIsLoading(false);
            return;
        }
        // --- End Validation ---

        // --- Create FormData ---
        const formData = new FormData();
        formData.append('age', age);
        formData.append('height', height);
        formData.append('gender', gender);
        formData.append('mbti', mbti);
        // Backend should use session/token to identify user

        // Append profile pictures (Backend field name: 'profilePictures')
        profilePictures.forEach((file) => {
            formData.append('profilePictures', file, file.name);
        });

        // Append business card (Backend field name: 'businessCard')
        if (businessCard) {
            formData.append('businessCard', businessCard, businessCard.name);
        }
        // --- End Create FormData ---

        console.log('Submitting profile completion with FormData...');

        try {
            // Use standard axios with credentials, not axiosInstance (token-based)
            const response = await axios.post<CompleteSocialResponse>(
                'http://localhost:3001/api/auth/complete-social', // ★ 백엔드 전체 URL
                 formData, 
                 { withCredentials: true } // ★ 세션 쿠키 전송
             );

            const data = response.data; // Now data has the type CompleteSocialResponse
            console.log('Response from /complete-social:', data);

            // Check for successful status codes and token
            if ((response.status === 200 || response.status === 201) && data.token) {
                localStorage.setItem('authToken', data.token);
                // Safely access user properties
                if (data.user?.id) {
                    localStorage.setItem('userId', data.user.id.toString());
                }
                if (data.user?.gender) {
                    localStorage.setItem('userGender', data.user.gender);
                }
                // Update user status based on response
                localStorage.setItem('userStatus', data.user?.status || 'pending_approval'); 
                console.log('Profile submitted successfully. Status:', data.user?.status);
                
                // --- Redirect to Pending Approval page ---
                alert(data.message || '프로필 정보가 제출되었습니다. 관리자 승인을 기다려주세요.'); 
                router.replace('/auth/pending-approval'); // Redirect to pending approval page
                // ------------------------------------------
            } else {
                 // Handle cases where response is 2xx but token/user data might be missing
                 setError(data.message || `회원가입 처리 중 예상치 못한 응답: ${response.status}`);
            }
        } catch (err: any) {
            console.error('Failed to complete profile:', err);
            let errorMessage = '예상치 못한 오류가 발생했습니다. 다시 시도해주세요.';
            if (err.response) {
                // Error from server response (e.g., 4xx, 5xx)
                // Access err.response.data safely (might contain specific error structure)
                errorMessage = err.response.data?.message || `서버 오류: ${err.response.status}`;
                 if (err.response.status === 401) {
                     errorMessage = '인증 오류가 발생했습니다. 다시 로그인해주세요.';
                     // Consider if redirect is needed here or handled by interceptor
                 } else if (err.response.status === 400) {
                     errorMessage = `입력 정보 오류: ${err.response.data?.message || '내용을 확인해주세요.'}`;
                 }
            } else if (err.request) {
                // Request made but no response
                errorMessage = '서버에 연결할 수 없습니다. 네트워크를 확인해주세요.';
            } else {
                // Error setting up request
                errorMessage = err.message || errorMessage;
            }
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    // --- Use consistent Styles --- 
    const inputBaseStyle = "w-full p-3 pl-10 rounded-full bg-slate-700 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 border border-slate-600 focus:border-amber-500 transition-colors";
    const selectBaseStyle = `${inputBaseStyle} pr-10`; // Add padding for dropdown arrow
    const labelStyle = "block text-sm font-medium text-slate-400 mb-1.5 sr-only"; // Labels hidden
    const formLabelStyle = "block text-sm font-medium text-slate-300 mb-1.5"; // Visible label for file inputs etc.
    const buttonBaseStyle = "w-full py-3 px-4 rounded-full font-semibold transition-colors duration-200";
    const iconWrapperStyle = "absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none";
    // Style for file input area
    const fileInputAreaStyle = "mt-1 flex items-center justify-center px-6 pt-5 pb-6 border-2 border-slate-600 border-dashed rounded-md hover:border-amber-500 transition-colors cursor-pointer";
    const fileInputLabelStyle = "relative cursor-pointer bg-slate-800 rounded-md font-medium text-amber-400 hover:text-amber-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-gray-950 focus-within:ring-amber-500 px-1";
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
                     <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-slate-200">프로필 완성하기</h2>
                     <p className="mt-2 text-center text-sm text-slate-400">
                       환영합니다, {name || '사용자'}님! ({email})
                     </p>
                     <p className="mt-1 text-center text-xs text-slate-500">
                        프로필을 완성하고 서비스를 시작하세요.
                     </p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    {/* Age Input */}
                    <div>
                        <label htmlFor="age" className={labelStyle}>나이</label>
                        <div className="relative mt-1">
                             <div className={iconWrapperStyle}>
                                 <CakeIcon className="h-5 w-5 text-slate-500" aria-hidden="true" />
                             </div>
                             <input
                                id="age"
                                name="age"
                                type="number"
                                required
                                min="19" // Example minimum age
                                className={inputBaseStyle}
                                placeholder="나이 (만)"
                                value={age}
                                onChange={(e) => setAge(e.target.value)}
                            />
                        </div>
                    </div>
                    
                    {/* Height Input */}
                    <div>
                         <label htmlFor="height" className={labelStyle}>키 (cm)</label>
                         <div className="relative mt-1">
                             <div className={iconWrapperStyle}>
                                 <ArrowsUpDownIcon className="h-5 w-5 text-slate-500" aria-hidden="true" />
                             </div>
                             <input
                                id="height"
                                name="height"
                                type="number"
                                required
                                min="100" // Example minimum height
                                className={inputBaseStyle}
                                placeholder="키 (cm)"
                                value={height}
                                onChange={(e) => setHeight(e.target.value)}
                            />
                        </div>
                    </div>
                    
                    {/* Gender Input */}
                    <div>
                        <label htmlFor="gender" className={labelStyle}>성별</label>
                        <div className="relative mt-1">
                             <div className={iconWrapperStyle}>
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
                                <option value="" disabled={!!gender}>성별 선택</option>
                                <option value="male">남성</option>
                                <option value="female">여성</option>
                            </select>
                             {/* Optional: Add a dropdown arrow icon absolutely positioned */}
                             <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                 <svg className="h-5 w-5 text-slate-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                     <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.23 8.29a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                                 </svg>
                             </div>
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
                                pattern="[EI][SN][TF][JP]" // Basic MBTI pattern validation
                                title="MBTI 유형 (예: INFP) 4글자를 입력하세요."
                                className={`${inputBaseStyle} uppercase`}
                                placeholder="MBTI (예: INFP)"
                                value={mbti}
                                onChange={(e) => setMbti(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))} // Allow only letters and force uppercase
                            />
                        </div>
                    </div>

                    {/* --- Profile Picture Input --- */}
                     <div>
                         <label htmlFor="profilePictures" className={formLabelStyle}>
                              프로필 사진 (최소 1장, 최대 3장) <span className="text-red-500">*</span>
                              <span className="text-xs text-slate-400 block">첫 번째 사진이 메인 프로필이 됩니다.</span>
                         </label>
                         {/* Make the dashed area clickable by wrapping in label */}
                         <label htmlFor="profilePictures" className={fileInputAreaStyle}>
                             <div className="space-y-1 text-center">
                                 <PhotoIcon className="mx-auto h-12 w-12 text-slate-500" />
                                 <div className="flex text-sm text-slate-400 justify-center">
                                     <span className={fileInputLabelStyle}>
                                         <span>파일 선택</span>
                                         {/* Hidden actual input */}
                                         <input id="profilePictures" name="profilePictures" type="file" className="sr-only" multiple accept="image/jpeg, image/png, image/gif" onChange={handleProfilePictureChange} required={profilePictures.length === 0} />
                                     </span>
                                     <p className="pl-1 hidden sm:inline">또는 드래그 앤 드롭</p> {/* Hide on very small screens */}
                                 </div>
                                 <p className="text-xs text-slate-500">JPG, PNG, GIF (각 10MB 이하)</p>
                             </div>
                         </label>
                         {/* Profile Picture Previews with Delete Button */}
                         {profilePicturePreviews.length > 0 && (
                             <div className="mt-3 grid grid-cols-3 gap-2">
                                 {profilePicturePreviews.map((url, index) => (
                                     <div key={index} className="relative aspect-square group border border-slate-700 rounded-md overflow-hidden">
                                         <img src={url} alt={`프로필 사진 미리보기 ${index + 1}`} className="object-cover w-full h-full" />
                                          {index === 0 && (
                                             <span className="absolute top-0 left-0 bg-amber-500 text-black text-xs font-bold px-1.5 py-0.5 rounded-br-md rounded-tl-md">메인</span>
                                          )}
                                          {/* Delete Button */}
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveProfilePicture(index)}
                                            className="absolute top-0.5 right-0.5 p-0.5 bg-black bg-opacity-60 rounded-full text-white hover:bg-opacity-80 focus:outline-none focus:ring-2 focus:ring-red-500 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                                            aria-label={`프로필 사진 ${index + 1} 삭제`}
                                          >
                                             <XMarkIcon className="h-4 w-4" />
                                          </button>
                                     </div>
                                 ))}
                             </div>
                         )}
                         {/* Display selected file count */}
                          {profilePictures.length > 0 && (
                            <p className="text-xs text-slate-400 mt-1 text-right">{profilePictures.length} / 3 장 선택됨</p>
                          )}
                     </div>
                     {/* --- End Profile Picture Input --- */}


                    {/* --- Business Card Input --- */}
                     <div>
                         <label htmlFor="businessCard" className={formLabelStyle}>
                             명함/직업 증명 사진 <span className="text-red-500">*</span>
                              <span className="text-xs text-slate-400 block">직업을 증명할 수 있는 명함, 사원증 등을 업로드해주세요.</span>
                         </label>
                         {/* Make the dashed area clickable */}
                         <label htmlFor="businessCard" className={fileInputAreaStyle}>
                             <div className="space-y-1 text-center">
                                 <BusinessCardIcon className="mx-auto h-12 w-12 text-slate-500" />
                                 <div className="flex text-sm text-slate-400 justify-center">
                                     <span className={fileInputLabelStyle}>
                                         <span>파일 선택</span>
                                         <input id="businessCard" name="businessCard" type="file" className="sr-only" accept="image/jpeg, image/png" onChange={handleBusinessCardChange} required={!businessCard} />
                                     </span>
                                     <p className="pl-1 hidden sm:inline">또는 드래그 앤 드롭</p>
                                 </div>
                                 <p className="text-xs text-slate-500">JPG, PNG (5MB 이하)</p>
                             </div>
                         </label>
                          {/* Business Card Preview with Delete Button */}
                          {businessCardPreview && (
                             <div className="mt-3 relative w-full max-w-[200px] mx-auto group border border-slate-700 rounded-md overflow-hidden">
                                 <img src={businessCardPreview} alt="명함 미리보기" className="object-contain w-full h-auto" />
                                 {/* Delete Button */}
                                 <button
                                    type="button"
                                    onClick={handleRemoveBusinessCard}
                                    className="absolute top-0.5 right-0.5 p-0.5 bg-black bg-opacity-60 rounded-full text-white hover:bg-opacity-80 focus:outline-none focus:ring-2 focus:ring-red-500 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                                    aria-label="명함 사진 삭제"
                                 >
                                     <XMarkIcon className="h-4 w-4" />
                                 </button>
                             </div>
                         )}
                         {/* Display selected file name */}
                         {businessCard && (
                            <p className="text-xs text-slate-400 mt-1 text-right truncate">{businessCard.name}</p>
                         )}
                     </div>
                     {/* --- End Business Card Input --- */}


                    {/* Error Display */}
                    {error && (
                        <div className="text-red-400 text-sm text-center p-3 bg-red-900 bg-opacity-50 rounded-lg border border-red-700">
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
                            {isLoading ? '저장 중...' : '프로필 완성 및 가입 완료'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
