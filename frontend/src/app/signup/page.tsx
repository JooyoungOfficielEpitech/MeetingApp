'use client'; // Declare as client component

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
// Import icons used in login page for consistency
import { LockClosedIcon, EnvelopeIcon, UserIcon } from '@heroicons/react/24/outline'; 
import { Montserrat, Inter } from 'next/font/google';
import axiosInstance from '@/utils/axiosInstance';

// Initialize fonts (same as login page)
const montserrat = Montserrat({ subsets: ['latin'], weight: ['700', '800'] });
const inter = Inter({ subsets: ['latin'] });

export default function SignupPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirm, setPasswordConfirm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Removed unused handlers and useEffects

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        if (password !== passwordConfirm) {
            setError('비밀번호가 일치하지 않습니다.');
            setIsLoading(false);
            return;
        }

        const signupData = { email, password };

        console.log('--- Sending Sign Up Request ---');
        console.log('POST /api/auth/signup');
        console.log(JSON.stringify(signupData, null, 2));

        try {
            const response = await axiosInstance.post('/api/auth/signup', signupData);
            const responseData = response.data as {
                token: string;
                user: {
                    status: string;
                    [key: string]: any;
                };
                message?: string;
            };

            console.log('Signup successful:', responseData);

            // --- Store token and user status --- 
            if (responseData.token && responseData.user) {
                localStorage.setItem('token', responseData.token);
                if (responseData.user.status) localStorage.setItem('user', responseData.user.status);
                if (responseData.user.id) localStorage.setItem('userId', responseData.user.id.toString());
                
                console.log('Token and status saved to localStorage.');

                // 프로필 완성 페이지로 리디렉션
                console.log('Redirecting to complete-profile page');
                alert('회원가입 성공! 프로필 완성을 위해 추가 정보를 입력해주세요.');
                router.push('/signup/complete-profile?isNewUser=true');
            } else {
                console.error('Signup response missing token or user status.', responseData);
                setError('회원가입은 완료되었으나 세션 초기화에 실패했습니다. 로그인을 시도해주세요.');
            }

        } catch (err: any) {
            console.error('Signup Error:', err);
            setError(err.response?.data?.message || err.message || '회원가입 중 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    // --- Updated Styles to match Login Page --- 
    const inputBaseStyle = "w-full p-3 pl-10 rounded-full bg-slate-700 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 border border-slate-600 focus:border-amber-500 transition-colors";
    const labelStyle = "block text-sm font-medium text-slate-400 mb-1.5 sr-only"; // Labels hidden visually but accessible
    const buttonBaseStyle = "w-full py-3 px-4 rounded-full font-semibold transition-colors duration-200";
    const iconWrapperStyle = "absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none";
    // -------------------------------------------

    return (
        // Use similar container and background as login
        <div className={`min-h-screen bg-black text-slate-100 flex items-center justify-center py-16 px-4 sm:px-6 lg:px-8 ${inter.className}`}> 
            {/* Use similar card style */}
            <div className="max-w-sm w-full space-y-8 bg-gray-950 p-10 rounded-2xl shadow-xl"> 
                {/* Consistent Logo/Header */}
                <div className="text-center">
                    <span className={`text-5xl font-bold text-amber-400 ${montserrat.className}`}>Logo</span> 
                    <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-slate-200">계정 생성하기</h2>
                    <p className="mt-2 text-center text-sm text-slate-400">
                        기본 정보를 입력하고 회원가입을 완료하세요
                    </p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    {/* Email Input (with icon) */}
                    <div>
                        <label htmlFor="email" className={labelStyle}>이메일</label>
                        <div className="relative mt-1">
                            <div className={iconWrapperStyle}>
                                <EnvelopeIcon className="h-5 w-5 text-slate-500" aria-hidden="true" />
                            </div>
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
                    </div>

                    {/* Password Input (with icon) */}
                    <div>
                        <label htmlFor="password" className={labelStyle}>비밀번호</label>
                        <div className="relative mt-1">
                            <div className={iconWrapperStyle}>
                                <LockClosedIcon className="h-5 w-5 text-slate-500" aria-hidden="true" />
                            </div>
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
                    </div>

                    {/* Confirm Password Input (with icon) */}
                    <div>
                        <label htmlFor="password-confirm" className={labelStyle}>비밀번호 확인</label>
                        <div className="relative mt-1">
                            <div className={iconWrapperStyle}>
                                <LockClosedIcon className="h-5 w-5 text-slate-500" aria-hidden="true" />
                            </div>
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
                    </div>
                    
                    {/* Error Display (consistent style) */}
                    {error && (
                        <div className="text-red-400 text-sm text-center p-2 bg-red-900 bg-opacity-40 rounded-md">
                            {error}
                        </div>
                    )}

                    {/* Submit Button (consistent style) */}
                    <div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`${buttonBaseStyle} bg-amber-500 hover:bg-amber-600 text-slate-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-amber-500 ${montserrat.className} font-semibold ${isLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                            {isLoading ? '처리 중...' : '회원가입'}
                        </button>
                    </div>
                </form>

                {/* Link to Login (consistent style) */}
                <div className="text-center text-sm">
                    <span className="text-slate-400">이미 계정이 있으신가요? </span>
                    <Link href="/" legacyBehavior>
                        <a className="font-medium text-amber-400 hover:text-amber-300">
                            로그인
                        </a>
                    </Link>
                </div>
            </div>
        </div>
    );
} 