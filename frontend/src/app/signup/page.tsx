'use client'; // Declare as client component

import React, { useState, ChangeEvent, useEffect } from 'react'; // Added useEffect
import Image from 'next/image'; // Correct import for next/image
import { ArrowLeftIcon, CameraIcon, CalendarIcon, PlusIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useRouter } from 'next/navigation'; // Import useRouter for redirection

// Define type for image preview - Keep if needed later for profile edit
// interface ImagePreview {
//   file: File;
//   previewUrl: string | null; 
//   fileType: string; 
// }

export default function SignupPage() {
  const router = useRouter(); // Initialize router
  // State for required fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [name, setName] = useState('');
  // State for loading and errors
  const [isLoading, setIsLoading] = useState(false); 
  const [error, setError] = useState<string | null>(null); 

  // Removed handlers and useEffects related to pictures, agreements etc. for basic signup

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true); // Start loading
    setError(null); // Clear previous errors

    if (password !== passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.'); 
      setIsLoading(false); // Stop loading
      return;
    }
    // Removed checks for profile picture and agreements for basic signup

    // Prepare data for the API call (only fields expected by the backend)
    const signupData = {
      email,
      password,
      name,
    };

    console.log('--- Sending Sign Up Request ---');
    console.log('POST /api/auth/signup');
    console.log(JSON.stringify(signupData, null, 2));

    try {
        const response = await fetch('http://localhost:3001/api/auth/signup', { // Use the actual backend URL
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(signupData),
        });

        const responseData = await response.json();

        if (!response.ok) {
            // Handle specific errors from the backend
            let errorMessage = responseData.message || '회원가입 중 오류가 발생했습니다.';
            if (responseData.errors && Array.isArray(responseData.errors)) {
               errorMessage = responseData.errors.map((err: any) => err.msg || '유효성 검사 오류').join(', ');
            }
            throw new Error(errorMessage);
        }

        console.log('Signup successful:', responseData);
        alert('회원가입이 완료되었습니다! 로그인을 진행해주세요.'); // Success message
        // Redirect to login page or main page after successful signup
        router.push('/'); // Redirect to home/login page

    } catch (error: any) {
        console.error('Signup Error:', error);
        setError(error.message || '회원가입 중 오류가 발생했습니다. 입력 정보를 확인하거나 나중에 다시 시도해주세요.'); 
    } finally {
        setIsLoading(false); // Stop loading regardless of success or failure
    }
  };

  // Tailwind CSS classes for styling
  const inputBaseStyle = "w-full p-3 rounded bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelStyle = "block text-sm font-medium text-gray-300 mb-1";
  const buttonBaseStyle = "w-full p-3 rounded";
  // Removed image related styles

  // Removed FileIcon component

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-gray-800 p-10 rounded-lg shadow-lg">
        {/* Logo (Temporary text) */}
        <div className="text-center text-2xl font-bold mb-6">logo</div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}> 
            {/* --- Input Fields (Email, Password, Confirm, Name) --- */}
             <div>
                 <label htmlFor="email" className={labelStyle}>이메일</label>
                 <input
                     id="email"
                     name="email"
                     type="email"
                     autoComplete="email"
                     required
                     className={inputBaseStyle}
                     placeholder="이메일 주소"
                     value={email}
                     onChange={(e) => setEmail(e.target.value)}
                 />
             </div>
             <div>
                 <label htmlFor="password" className={labelStyle}>비밀번호</label>
                 <input
                     id="password"
                     name="password"
                     type="password"
                     autoComplete="new-password"
                     required
                     minLength={6}
                     className={inputBaseStyle}
                     placeholder="비밀번호 (6자 이상)"
                     value={password}
                     onChange={(e) => setPassword(e.target.value)}
                 />
             </div>
             <div>
                 <label htmlFor="password-confirm" className={labelStyle}>비밀번호 확인</label>
                 <input
                     id="password-confirm"
                     name="password-confirm"
                     type="password"
                     autoComplete="new-password"
                     required
                     className={inputBaseStyle}
                     placeholder="비밀번호 확인"
                     value={passwordConfirm}
                     onChange={(e) => setPasswordConfirm(e.target.value)}
                 />
             </div>
             <div>
                 <label htmlFor="name" className={labelStyle}>이름</label>
                 <input
                     id="name"
                     name="name"
                     type="text"
                     autoComplete="name"
                     required
                     className={inputBaseStyle}
                     placeholder="이름"
                     value={name}
                     onChange={(e) => setName(e.target.value)}
                 />
             </div>
            {/* --- Removed fields not needed for basic signup --- */}

            {/* Display error message */}
            {error && (
                <div className="text-red-500 text-sm text-center p-2 bg-red-900 bg-opacity-50 rounded">
                   {error}
                </div>
            )}

            {/* --- Submit Button --- */}
            <div>
                <button
                    type="submit"
                    disabled={isLoading} // Disable button when loading
                    className={`${buttonBaseStyle} bg-blue-600 hover:bg-blue-700 text-white font-semibold transition duration-150 ease-in-out ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    {isLoading ? '가입 처리 중...' : '가입하기'} {/* Show loading text */}
                </button>
            </div>
        </form>
         {/* Optional: Link to Login */}
         <div className="text-center mt-4">
             <Link href="/" className="text-sm text-blue-400 hover:text-blue-300">
                 이미 계정이 있으신가요? 로그인
             </Link>
         </div>
      </div>
    </div>
  );
} 