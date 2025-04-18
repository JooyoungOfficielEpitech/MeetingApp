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
  
  console.log(`[파일 이름 변경] 원본: ${file.name}, 새 이름: ${newFileName}, 타입: ${file.type}, 크기: ${file.size} 바이트`);
  
  // 새 파일 이름으로 파일 객체 생성 (타입, 내용 유지)
  const renamedFile = new File([file], newFileName, { type: file.type });
  console.log(`[파일 이름 변경] 변경 완료:`, {
    name: renamedFile.name,
    type: renamedFile.type,
    size: renamedFile.size,
    lastModified: renamedFile.lastModified
  });
  
  return renamedFile;
};

// --- Inner component using hooks ---
function ProfileContent() {
    console.log("🚨🚨🚨 프로필 페이지 컴포넌트 로드됨");
    
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

    // 디버깅을 위한 useEffect 추가
    useEffect(() => {
        console.log("🚨🚨🚨 ProfileContent 컴포넌트가 마운트되었습니다");
        
        // 브라우저에서 전역 함수로 노출시켜 콘솔에서 직접 테스트 가능하게 함
        // @ts-ignore
        window.debugProfileImages = {
            showCurrentImages: () => {
                console.log("현재 이미지 상태:", {
                    uploadedImages: uploadedProfileImages,
                    previewUrls: profileImagePreviews,
                });
                return "이미지 정보가 콘솔에 출력되었습니다.";
            },
            addTestImage: () => {
                // 테스트용 이미지 URL 추가
                const testUrl = "https://via.placeholder.com/150";
                setProfileImagePreviews(prev => [...prev, testUrl]);
                console.log("테스트 이미지 URL이 추가되었습니다:", testUrl);
                return "테스트 이미지가 추가되었습니다.";
            }
        };
        
        return () => {
            console.log("🚨🚨🚨 ProfileContent 컴포넌트가 언마운트되었습니다");
            // @ts-ignore
            delete window.debugProfileImages;
        };
    }, []);

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
                router.push('/');
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
        console.log("🔴🔴🔴 [이미지 업로드] 파일 선택 이벤트 발생:", e.target.files?.length);
        
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            console.log("🔴🔴🔴 [이미지 업로드] 선택된 파일 정보:", newFiles.map(f => ({
                name: f.name,
                type: f.type,
                size: f.size,
                lastModified: f.lastModified
            })));
            
            // 기존 파일과 합쳐서 최대 3개까지만 허용
            const combinedFiles = [...uploadedProfileImages, ...newFiles];
            if (combinedFiles.length > 3) {
                alert('프로필 사진은 최대 3장까지 업로드할 수 있습니다.');
                return;
            }
            
            // 파일 이름 UUID로 변경
            const renamedFiles = newFiles.map(file => {
                const renamed = renameFileWithUUID(file);
                console.log(`🔴🔴🔴 [이미지 업로드] 파일 이름 변경: ${file.name} -> ${renamed.name}`);
                return renamed;
            });
            
            const updatedFiles = [...uploadedProfileImages, ...renamedFiles];
            console.log("🔴🔴🔴 [이미지 업로드] 업데이트된 파일 목록:", updatedFiles.map(f => f.name));
            setUploadedProfileImages(updatedFiles);
            
            // 미리보기 URL 생성
            // 기존 미리보기 URL은 유지하고 새 이미지에 대한 미리보기만 추가
            const newPreviewUrls = newFiles.map(file => {
                const url = URL.createObjectURL(file);
                console.log(`🔴🔴🔴 [이미지 업로드] 미리보기 URL 생성: ${url} (${file.name})`);
                return url;
            });
            
            setProfileImagePreviews(prev => {
                const updated = [...prev, ...newPreviewUrls];
                console.log("🔴🔴🔴 [이미지 업로드] 미리보기 URL 목록 업데이트:", updated.length);
                return updated;
            });
            
            // 입력 필드 초기화
            if (e.target.value) {
                e.target.value = '';
            }
        } else {
            console.log("🔴🔴🔴 [이미지 업로드] 파일이 선택되지 않음");
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
        console.log("🚨🚨🚨 프로필 저장 시작 - 폼 제출됨");
        e.preventDefault();
        if (isSaving) return; // Prevent duplicate submissions
        setIsSaving(true);
        setError(null);

        console.log("🚨🚨🚨 현재 이미지 상태:", { 
            업로드대기: uploadedProfileImages.length, 
            "파일명": uploadedProfileImages.map(f => f.name),
            미리보기: profileImagePreviews.length 
        });

        // 유효성 검사 추가
        const isFirstCompletion = userProfile?.status === 'pending_profile';
        console.log("🔴🔴🔴 [프로필 저장] 첫 프로필 작성 여부:", isFirstCompletion, "현재 상태:", userProfile?.status);
        
        const errors: string[] = [];
        
        // 기본 필드 검사
        if (!formData.nickname || formData.nickname.trim() === '') 
            errors.push('닉네임은 필수입니다.');
        if (!formData.gender) 
            errors.push('성별은 필수입니다.');
        if (!formData.city) 
            errors.push('도시는 필수입니다.');
        
        // 이미지 업로드 검사 - 첫 프로필 작성 시에만 필수
        console.log("🔴🔴🔴 [프로필 저장] 이미지 현황 - 업로드 대기: ", uploadedProfileImages.length, "미리보기: ", profileImagePreviews.length);
        
        if (isFirstCompletion && profileImagePreviews.length === 0 && uploadedProfileImages.length === 0) {
            errors.push('첫 프로필 작성 시 최소 한 장의 프로필 이미지가 필요합니다.');
            console.log("🔴🔴🔴 [프로필 저장] 이미지 부족 오류 발생!");
        }
        
        if (errors.length > 0) {
            console.log("🔴🔴🔴 [프로필 저장] 유효성 검사 실패:", errors);
            setError(errors.join('\n'));
            setIsSaving(false);
            return;
        }

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
        
        // 디버깅을 위한 로그 추가
        console.log('🔴🔴🔴 [프로필 저장] 이미지 파일 수:', uploadedProfileImages.length);
        
        // 새로 업로드한 프로필 이미지가 있는 경우 추가
        if (uploadedProfileImages.length > 0) {
            uploadedProfileImages.forEach((file, index) => {
                console.log(`🔴🔴🔴 [프로필 저장] 이미지 ${index+1} 추가:`, file.name, file.size, file.type);
                formDataToSend.append('profilePictures', file);
                
                // 디버깅용: 파일이 제대로 추가되었는지 확인
                alert(`이미지 ${index+1} 추가됨: ${file.name} (${Math.round(file.size/1024)}KB)`);
            });
        } else {
            console.log('🔴🔴🔴 [프로필 저장] 업로드할 새 이미지 없음 - 미리보기만 있을 수 있음');
            alert('업로드할 이미지가 없습니다! 이미지를 선택해주세요.');
            
            // 이미지가 없으면 저장 중단 (첫 프로필 작성 시에만)
            if (isFirstCompletion) {
                setIsSaving(false);
                setError('첫 프로필 작성 시에는 이미지가 필수입니다.');
                return;
            }
        }
        
        // FormData 디버깅
        console.log('🔴🔴🔴 [프로필 저장] FormData 키 목록:');
        for (const key of formDataToSend.keys()) {
            const values = formDataToSend.getAll(key);
            console.log(`- ${key}: ${values.length}개 항목`);
            if (key !== 'profilePictures') {
                console.log(`  값: ${values.join(', ')}`);
            } else {
                console.log(`  파일 이름: ${values.map((v: any) => v.name).join(', ')}`);
            }
        }

        try {
            console.log('🔴🔴🔴 [프로필 저장] 프로필 업데이트 API 요청 시작 (multipart/form-data)');
            
            // FormData 검증
            let hasImages = false;
            for (const entry of formDataToSend.entries()) {
                if (entry[0] === 'profilePictures') {
                    hasImages = true;
                    break;
                }
            }
            
            if (!hasImages && isFirstCompletion) {
                alert('FormData에 이미지가 없습니다! 저장이 중단됩니다.');
                setIsSaving(false);
                setError('FormData에 이미지가 없습니다. 다시 시도해주세요.');
                return;
            }
            
            // FormData 검증 통과 후 전송
            alert(`프로필 저장을 시작합니다.${hasImages ? ' 이미지 포함' : ' 이미지 없음'}`);
            
            const response = await axiosInstance.post('/api/profile/complete-regular', formDataToSend, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            console.log('🔴🔴🔴 [프로필 저장] 프로필 업데이트 응답 상태:', response.status);
            console.log('🔴🔴🔴 [프로필 저장] 프로필 업데이트 응답 데이터:', response.data);

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
                            
                            {/* 이미지 미리보기 */}
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
                                            onClick={() => {
                                                alert(`이미지 ${index+1}을 삭제합니다`);
                                                handleRemoveProfileImage(index);
                                            }}
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
                            
                            {/* 새로운 직접 보이는 파일 입력 */}
                            <div className="border-2 border-dashed border-gray-600 rounded-lg p-4 bg-gray-800">
                                <p className="text-sm text-amber-400 mb-2">직접 파일 선택:</p>
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    className="w-full text-sm text-gray-300"
                                    onChange={(e) => {
                                        alert(`파일 선택됨: ${e.target.files?.length}개`);
                                        console.log("🚨🚨🚨 파일 선택됨:", e.target.files?.length);
                                        if (e.target.files && e.target.files.length > 0) {
                                            const files = Array.from(e.target.files);
                                            console.log("🚨🚨🚨 선택된 파일들:", files.map(f => f.name).join(", "));
                                            
                                            // 기존 이미지와 새 이미지의 합이 3개를 초과하는지 확인
                                            if (profileImagePreviews.length + files.length > 3) {
                                                alert(`프로필 사진은 최대 3장까지만 가능합니다. 현재 ${profileImagePreviews.length}장이 있어 ${3-profileImagePreviews.length}장만 더 추가할 수 있습니다.`);
                                                return;
                                            }
                                            
                                            // 간단한 처리로 변경
                                            setUploadedProfileImages(prev => [...prev, ...files]);
                                            
                                            // 미리보기 URL 생성
                                            const urls = files.map(file => URL.createObjectURL(file));
                                            setProfileImagePreviews(prev => [...prev, ...urls]);
                                            
                                            alert(`파일 ${files.length}개가 추가되었습니다!`);
                                        }
                                    }}
                                />
                                <p className="text-xs text-gray-400 mt-2">* 최대 3장까지 업로드 가능, 첫 번째 사진이 메인 이미지로 사용됩니다.</p>
                            </div>

                            <div className="text-xs text-gray-500 mt-1">
                                업로드된 이미지: {uploadedProfileImages.length}개, 
                                미리보기: {profileImagePreviews.length}개, 
                                상태: {userProfile?.status || '정보 없음'}
                            </div>
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