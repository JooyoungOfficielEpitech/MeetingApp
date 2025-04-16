'use client';

import React, { useState, useEffect, ChangeEvent, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
// Import icons for consistency 
import { UserIcon, CakeIcon, ArrowsUpDownIcon, TagIcon, PhotoIcon, IdentificationIcon as BusinessCardIcon, XMarkIcon } from '@heroicons/react/24/outline'; 
import { Montserrat, Inter } from 'next/font/google';
// Import axiosInstance
import axiosInstance from '@/utils/axiosInstance'; // Ensure this path is correct for your project structure
// --- axios import 추가 ---
import axios from 'axios'; // Assuming standard axios is available
// -----------------------
// UUID 생성 라이브러리 추가
import { v4 as uuidv4 } from 'uuid';

// Initialize fonts (same as login page)
const montserrat = Montserrat({ subsets: ['latin'], weight: ['700', '800'] });
const inter = Inter({ subsets: ['latin'] });

// Define interfaces for API response data types
interface UserData {
    id?: number | string;
    nickname?: string;
    gender?: string;
    status?: string;
    city?: string; // 도시 필드 추가
    // Add other user fields if present in the response
}

interface ProfileResponse {
    user: {
        id: number | string;
        nickname?: string;
        gender?: string;
        status?: string;
        city?: string; // 도시 필드 추가
    };
}

interface CompleteSocialResponse {
    token: string;
    user: {
        id: number | string;
        gender?: string;
        status?: string;
        city?: string; // 도시 필드 추가
        [key: string]: any;
    };
    message?: string; // Optional error/success message
}

// 기존 사용자 업데이트 응답 인터페이스 추가
interface ProfileUpdateResponse {
    user?: {
        id?: number | string;
        nickname?: string;
        gender?: string;
        status?: string;
        city?: string; // 도시 필드 추가
        [key: string]: any;
    };
    message?: string;
}

interface ProfileFormData {
  nickname: string;
  gender: string;
  city: string; // 도시 필드 추가
  age?: string;
  height?: string;
  mbti?: string;
  [key: string]: string | undefined;
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

// Client Component that uses useSearchParams
function CompleteProfileContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const isNewUser = searchParams.get('newUser') === 'true' || searchParams.get('isNewUser') === 'true';
    const [loading, setLoading] = useState(false);
    const [loginChecked, setLoginChecked] = useState(false);
    
    const { register, handleSubmit, setValue, formState: { errors } } = useForm<ProfileFormData>();

    // State for pre-filled data from session
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [gender, setGender] = useState('');

    // State for user inputs
    const [age, setAge] = useState('');
    const [height, setHeight] = useState('');
    const [mbti, setMbti] = useState('');
    const [city, setCity] = useState(''); // 도시 상태 추가

    // Add state for files and previews
    const [profilePictures, setProfilePictures] = useState<File[]>([]);
    const [businessCard, setBusinessCard] = useState<File | null>(null);
    const [profilePicturePreviews, setProfilePicturePreviews] = useState<string[]>([]);
    const [businessCardPreview, setBusinessCardPreview] = useState<string | null>(null);

    // State for user data
    const [userData, setUserData] = useState<UserData>({} as UserData);

    // 로그인 상태 확인
    useEffect(() => {
        console.log('[CompleteProfile] 페이지 로드 - 로그인 상태 확인 중');
        console.log('[CompleteProfile] URL 파라미터:', { isNewUser, searchParams });

        // URL에서 직접 isNewUser 확인
        const urlParams = new URLSearchParams(window.location.search);
        const isNewUserParam = urlParams.get('isNewUser') === 'true';
        
        console.log('[CompleteProfile] URL 직접 확인 결과:', {
          isNewUserParam,
          rawParam: urlParams.get('isNewUser'),
          fullUrlParams: Object.fromEntries(urlParams.entries())
        });

        // 로컬 스토리지에서 토큰 확인
        const token = localStorage.getItem('token');
        const hasToken = !!token;
        console.log('[CompleteProfile] 로컬 스토리지 토큰 존재:', hasToken);

        // 리디렉션 파라미터가 있거나 토큰이 있으면 진행
        if (isNewUserParam || isNewUser) {
          console.log('[CompleteProfile] 신규 사용자 감지. 프로필 작성 폼 로드');
          // 신규 사용자 흐름 - 토큰 확인 없이 진행
          setLoginChecked(true);
          return;
        } else if (hasToken) {
          console.log('[CompleteProfile] 기존 사용자 감지. 프로필 정보 로드 중');
          // 기존 사용자 - 프로필 정보 가져오기
          fetchUserProfile(token);
        } else {
          // 토큰 없고 신규 사용자 표시도 없는 경우
          console.log('[CompleteProfile] 토큰 없음. 로그인 페이지로 이동');
          router.push('/');
        }
    }, [isNewUser, router, searchParams]);

    const fetchUserProfile = async (token: string) => {
        try {
            setLoading(true);
            console.log('[CompleteProfile] 프로필 정보 요청 중');
            
            const response = await axiosInstance.get<ProfileResponse>('/api/profile/me', {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            
            console.log('[CompleteProfile] 프로필 정보 응답:', response.data);
            
            if (response.data && response.data.user) {
                setUserData({
                    id: response.data.user.id,
                    nickname: response.data.user.nickname || '',
                    gender: response.data.user.gender || '',
                    status: response.data.user.status,
                    city: response.data.user.city || ''
                });
                setLoginChecked(true);
            } else {
                // 사용자 정보가 없으면 빈 객체로 초기화
                console.log('[CompleteProfile] 응답에 사용자 정보 없음. 빈 객체로 초기화');
                setUserData({} as UserData);
                setLoginChecked(true);
            }
        } catch (error: any) {
            console.error('[CompleteProfile] 사용자 정보 조회 실패:', error);
            localStorage.removeItem('token');
            router.push('/');
        } finally {
            setLoading(false);
        }
    };

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

    // 나이 입력 핸들러
    const handleAgeChange = (e: ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setAge(value);
        setValue('age', value); // React Hook Form 상태도 업데이트
    };
    
    // 키 입력 핸들러
    const handleHeightChange = (e: ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setHeight(value);
        setValue('height', value); // React Hook Form 상태도 업데이트
    };
    
    // MBTI 입력 핸들러
    const handleMbtiChange = (e: ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.toUpperCase();
        setMbti(value);
        setValue('mbti', value); // React Hook Form 상태도 업데이트
    };

    const onSubmit = async (data: ProfileFormData) => {
        setLoading(true);
        console.log('[CompleteProfile] 프로필 제출 데이터:', data);
        
        // 파일 업로드 유효성 검사
        if (profilePictures.length === 0) {
            alert('최소 한 장의 프로필 사진이 필요합니다.');
            setLoading(false);
            return;
        }
        
        if (!businessCard) {
            alert('명함 또는 직업 증명 사진이 필요합니다.');
            setLoading(false);
            return;
        }
        
        try {
            // 소셜 로그인 신규 사용자인 경우 (토큰이 없는 경우)
            if (isNewUser && !localStorage.getItem('token')) {
                console.log('[CompleteProfile] 소셜 로그인 신규 사용자 - 세션 기반 요청');
                
                // FormData 객체 생성
                const formData = new FormData();
                
                // 기본 정보 추가
                formData.append('nickname', data.nickname);
                formData.append('gender', data.gender);
                formData.append('age', data.age || '');
                formData.append('height', data.height || '');
                formData.append('mbti', (data.mbti || '').toUpperCase());
                formData.append('city', data.city); // 도시 정보 추가
                
                // 프로필 사진 추가 (최대 3장) - UUID로 파일명 변경
                profilePictures.forEach((file, index) => {
                    // 파일 이름을 UUID로 변경
                    const renamedFile = renameFileWithUUID(file);
                    formData.append('profilePictures', renamedFile);
                });
                
                // 명함 추가 - UUID로 파일명 변경
                if (businessCard) {
                    const renamedBusinessCard = renameFileWithUUID(businessCard);
                    formData.append('businessCard', renamedBusinessCard);
                }
                
                // 디버깅을 위해 FormData 내용 출력 (FormData는 직접 출력할 수 없음)
                console.log('[CompleteProfile] 전송할 데이터:');
                console.log('- 닉네임:', data.nickname);
                console.log('- 성별:', data.gender);
                console.log('- 나이:', data.age);
                console.log('- 키:', data.height);
                console.log('- MBTI:', data.mbti?.toUpperCase());
                console.log('- 프로필 사진 수:', profilePictures.length);
                console.log('- 명함 파일:', businessCard?.name);
                
                // 백엔드에서 세션을 통해 사용자를 식별할 수 있도록 자격 증명 포함
                const response = await axiosInstance.post<CompleteSocialResponse>('/api/auth/complete-social', formData, {
                    withCredentials: true, // 중요: 세션 쿠키 전송을 위해 필요
                    headers: {
                        'Content-Type': 'multipart/form-data' // 파일 업로드를 위한 헤더
                    }
                });
                
                console.log('[CompleteProfile] 소셜 프로필 완성 응답:', response.data);
                
                // 응답에서 토큰 저장
                if (response.data.token) {
                    localStorage.setItem('token', response.data.token);
                    
                    if (response.data.user) {
                        if (response.data.user.id) {
                            localStorage.setItem('userId', response.data.user.id.toString());
                        }
                        if (response.data.user.gender) {
                            localStorage.setItem('userGender', response.data.user.gender);
                        }
                        if (response.data.user.status) {
                            localStorage.setItem('user', response.data.user.status);
                        }
                    }
                }
                
                alert('프로필 설정이 완료되었습니다!');
                
                // 상태에 따라 리디렉션
                console.log('[CompleteProfile] 유저 상태:', response.data.user?.status);
                if (response.data.user && response.data.user.status === 'pending_approval') {
                    console.log('[CompleteProfile] 승인 대기 상태로 이동');
                    router.replace('/auth/pending-approval');
                } else {
                    console.log('[CompleteProfile] 메인 페이지로 이동');
                    router.replace('/main');
                }
            } else {
                // 기존 사용자 업데이트 흐름
                const response = await axiosInstance.put<ProfileUpdateResponse>('/api/profile/me', data);
                console.log('[CompleteProfile] 프로필 업데이트 응답:', response.data);
                
                // 상태 업데이트
                localStorage.setItem('userGender', data.gender);
                
                alert('프로필 설정이 완료되었습니다!');
                
                // 상태 확인 후 리다이렉션
                if (response.data && response.data.user && response.data.user.status === 'pending_approval') {
                    console.log('[CompleteProfile] 기존 사용자 - 승인 대기 상태로 이동');
                    router.replace('/auth/pending-approval');
                } else {
                    console.log('[CompleteProfile] 기존 사용자 - 메인 페이지로 이동');
                    router.replace('/main');
                }
            }
        } catch (error: any) {
            console.error('[CompleteProfile] 프로필 업데이트 오류:', error);
            
            // 유효성 검사 오류 처리
            if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
                const errorMessages = error.response.data.errors.join('\n');
                alert(`프로필 설정 중 오류가 발생했습니다:\n${errorMessages}`);
            } else {
                alert(`프로필 설정 중 오류가 발생했습니다: ${error.response?.data?.message || error.message || '알 수 없는 오류'}`);
            }
        } finally {
            setLoading(false);
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

    if (!loginChecked) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
                <div className="text-center">
                    <p className="text-xl font-semibold">로그인 상태 확인 중...</p>
                    <p className="text-gray-400 mt-2">잠시만 기다려주세요.</p>
                </div>
            </div>
        );
    }

    return (
        <div className={`min-h-screen bg-black text-slate-100 flex items-center justify-center py-16 px-4 sm:px-6 lg:px-8 ${inter.className}`}>
            <div className="max-w-sm w-full space-y-8 bg-gray-950 p-10 rounded-2xl shadow-xl">
                <div className="text-center">
                    <span className={`text-5xl font-bold text-amber-400 ${montserrat.className}`}>Logo</span> 
                    <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-slate-200">프로필 완성하기</h2>
                    <p className="mt-2 text-center text-sm text-slate-400">
                        추가 정보를 입력하여 프로필을 완성해주세요.
                    </p>
                </div>
                
                <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-6">
                    {/* 닉네임 */}
                    <div>
                        <label htmlFor="nickname" className={labelStyle}>닉네임</label>
                        <div className="relative mt-1">
                            <div className={iconWrapperStyle}><UserIcon className="h-5 w-5 text-slate-500"/></div>
                            <input
                                id="nickname"
                                type="text"
                                placeholder="닉네임"
                                className={inputBaseStyle}
                                {...register('nickname', { required: '닉네임은 필수입니다' })}
                            />
                        </div>
                        {errors.nickname && (
                            <p className="text-red-500 text-sm mt-1">{errors.nickname.message}</p>
                        )}
                    </div>
                    
                    {/* 성별 */}
                    <div>
                        <label htmlFor="gender" className={labelStyle}>성별</label>
                        <div className="relative mt-1">
                            <div className={iconWrapperStyle}><UserIcon className="h-5 w-5 text-slate-500"/></div>
                            <select
                                id="gender"
                                className={selectBaseStyle}
                                {...register('gender', { required: '성별을 선택해주세요' })}
                            >
                                <option value="">성별 선택</option>
                                <option value="male">남성</option>
                                <option value="female">여성</option>
                                <option value="other">기타</option>
                            </select>
                        </div>
                        {errors.gender && (
                            <p className="text-red-500 text-sm mt-1">{errors.gender.message}</p>
                        )}
                    </div>
                    
                    {/* 사는 도시 */}
                    <div>
                        <label htmlFor="city" className={labelStyle}>사는 도시</label>
                        <div className="relative mt-1">
                            <div className={iconWrapperStyle}><UserIcon className="h-5 w-5 text-slate-500"/></div>
                            <select
                                id="city"
                                className={selectBaseStyle}
                                {...register('city', { required: '사는 도시를 선택해주세요' })}
                            >
                                <option value="">도시 선택</option>
                                <option value="seoul">서울</option>
                                <option value="busan">부산</option>
                                <option value="jeju">제주</option>
                            </select>
                        </div>
                        {errors.city && (
                            <p className="text-red-500 text-sm mt-1">{errors.city.message}</p>
                        )}
                    </div>
                    
                    {/* 나이 */}
                    <div>
                        <label htmlFor="age" className={labelStyle}>나이</label>
                        <div className="relative mt-1">
                            <div className={iconWrapperStyle}><CakeIcon className="h-5 w-5 text-slate-500"/></div>
                            <input
                                id="age"
                                type="number"
                                placeholder="나이"
                                className={inputBaseStyle}
                                min="19"
                                required
                                value={age}
                                {...register('age', { 
                                    required: '나이를 입력해주세요', 
                                    min: { value: 19, message: '19세 이상이어야 합니다' } 
                                })}
                                onChange={handleAgeChange}
                            />
                        </div>
                        {errors.age && (
                            <p className="text-red-500 text-sm mt-1">{errors.age.message}</p>
                        )}
                    </div>
                    
                    {/* 신장 */}
                    <div>
                        <label htmlFor="height" className={labelStyle}>신장 (cm)</label>
                        <div className="relative mt-1">
                            <div className={iconWrapperStyle}><ArrowsUpDownIcon className="h-5 w-5 text-slate-500"/></div>
                            <input
                                id="height"
                                type="number"
                                placeholder="신장 (cm)"
                                className={inputBaseStyle}
                                min="100"
                                required
                                value={height}
                                {...register('height', { 
                                    required: '신장을 입력해주세요', 
                                    min: { value: 100, message: '100cm 이상이어야 합니다' } 
                                })}
                                onChange={handleHeightChange}
                            />
                        </div>
                        {errors.height && (
                            <p className="text-red-500 text-sm mt-1">{errors.height.message}</p>
                        )}
                    </div>
                    
                    {/* MBTI */}
                    <div>
                        <label htmlFor="mbti" className={labelStyle}>MBTI</label>
                        <div className="relative mt-1">
                            <div className={iconWrapperStyle}><TagIcon className="h-5 w-5 text-slate-500"/></div>
                            <input
                                id="mbti"
                                type="text"
                                placeholder="MBTI (예: INFP)"
                                className={`${inputBaseStyle} uppercase`}
                                maxLength={4}
                                required
                                value={mbti}
                                {...register('mbti', { 
                                    required: 'MBTI를 입력해주세요',
                                    pattern: { 
                                        value: /^[EI][SN][TF][JP]$/i, 
                                        message: '올바른 MBTI 형식이 아닙니다 (예: INFP)' 
                                    } 
                                })}
                                onChange={handleMbtiChange}
                            />
                        </div>
                        {errors.mbti && (
                            <p className="text-red-500 text-sm mt-1">{errors.mbti.message}</p>
                        )}
                    </div>
                    
                    {/* 프로필 사진 업로드 */}
                    <div>
                        <label htmlFor="profile-pictures" className={formLabelStyle}>프로필 사진 (최대 3장)</label>
                        <div className={fileInputAreaStyle}>
                            <input
                                id="profile-pictures"
                                type="file"
                                accept="image/*"
                                multiple
                                className="sr-only"
                                onChange={handleProfilePictureChange}
                            />
                            <label htmlFor="profile-pictures" className="w-full text-center cursor-pointer">
                                <PhotoIcon className="mx-auto h-12 w-12 text-slate-500" />
                                <span className="mt-2 block text-sm font-medium text-slate-300">
                                    사진 선택하기
                                </span>
                                <span className="mt-1 block text-xs text-slate-500">
                                    PNG, JPG, GIF 최대 10MB (필수)
                                </span>
                            </label>
                        </div>
                        
                        {/* 프로필 사진 미리보기 */}
                        {profilePicturePreviews.length > 0 && (
                            <div className="mt-4 grid grid-cols-3 gap-2">
                                {profilePicturePreviews.map((url, index) => (
                                    <div key={index} className="relative">
                                        <img src={url} alt={`Preview ${index}`} className="w-full h-24 object-cover rounded-md" />
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveProfilePicture(index)}
                                            className="absolute inset-0 w-full h-full bg-black bg-opacity-50 rounded-md flex items-center justify-center text-white"
                                        >
                                            <XMarkIcon className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    
                    {/* 명함 업로드 */}
                    <div>
                        <label htmlFor="businessCard" className={formLabelStyle}>명함 또는 직업 증명 사진</label>
                        <div className={fileInputAreaStyle}>
                            <input
                                id="businessCard"
                                type="file"
                                accept="image/*"
                                className="sr-only"
                                onChange={handleBusinessCardChange}
                            />
                            <label htmlFor="businessCard" className="w-full text-center cursor-pointer">
                                <BusinessCardIcon className="mx-auto h-12 w-12 text-slate-500" />
                                <span className="mt-2 block text-sm font-medium text-slate-300">
                                    사진 선택하기
                                </span>
                                <span className="mt-1 block text-xs text-slate-500">
                                    PNG, JPG, GIF 최대 10MB (필수)
                                </span>
                            </label>
                        </div>
                        
                        {/* 명함 미리보기 */}
                        {businessCardPreview && (
                            <div className="mt-4">
                                <img src={businessCardPreview} alt="Business Card Preview" className="w-full h-24 object-cover rounded-md" />
                                <button
                                    type="button"
                                    onClick={handleRemoveBusinessCard}
                                    className="mt-2 w-full py-2 bg-red-500 text-white rounded-md"
                                >
                                    <XMarkIcon className="h-4 w-4 mr-2" />
                                    사진 제거하기
                                </button>
                            </div>
                        )}
                    </div>
                    
                    <button type="submit" className={buttonBaseStyle}>
                        프로필 완성하기
                    </button>
                </form>
            </div>
        </div>
    );
}

// Main page component with Suspense
export default function CompleteProfilePage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
                <div className="text-center">
                    <p className="text-xl font-semibold">로딩 중...</p>
                    <p className="text-gray-400 mt-2">잠시만 기다려주세요.</p>
                </div>
            </div>
        }>
            <CompleteProfileContent />
        </Suspense>
    );
}