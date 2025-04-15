'use client';

import React, { ReactNode, useEffect, useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

interface AuthGuardProps {
  children: ReactNode;
  requiredStatus?: 'active' | 'pending_approval' | 'pending_profile' | 'rejected' | 'suspended';
}

export default function AuthGuard({ children, requiredStatus = 'active' }: AuthGuardProps) {
  const { isAuthenticated, status, checkAuth, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);

  // 공개 경로 정의
  const publicPaths = [
    '/', 
    '/signup', 
    '/auth/callback', 
    '/auth/pending-approval', 
    '/signup/complete-profile'
  ];
  const isPublicPath = publicPaths.includes(pathname);

  // 관리자 경로 확인
  const isAdminPath = pathname.startsWith('/admin');

  // 인증 확인 함수
  const verifyAuthentication = useCallback(async () => {
    try {
      // 공개 경로면 인증 확인 건너뛰기
      if (isPublicPath) {
        setChecking(false);
        return;
      }

      // 관리자 확인 - 브라우저 환경에서만 실행
      let isAdmin = false;
      if (typeof window !== 'undefined') {
        try {
          isAdmin = localStorage.getItem('isAdmin') === 'true';
        } catch (e) {
          console.error('localStorage 접근 오류:', e);
        }
      }
      
      // 관리자 경로 접근 처리
      if (isAdminPath) {
        if (isAdmin) {
          // 관리자가 관리자 페이지 접근 - 허용
          setChecking(false);
        } else {
          // 일반 사용자가 관리자 페이지 접근 - 메인으로 리디렉션
          router.push('/');
        }
        return;
      }
      
      // 관리자 계정이 일반 페이지 접근 시 허용
      if (isAdmin) {
        setChecking(false);
        return;
      }
      
      // 일반 사용자 인증 확인
      const authenticated = await checkAuth();
      
      if (!authenticated) {
        router.push('/');
        return;
      }
      
      // 사용자 상태에 따른 리디렉션 처리
      if (status === 'pending_profile' && pathname !== '/signup/complete-profile') {
        router.push('/signup/complete-profile');
        return;
      }
      
      if (status === 'pending_approval' && pathname !== '/auth/pending-approval') {
        router.push('/auth/pending-approval');
        return;
      }
      
      if ((status === 'rejected' || status === 'suspended') && pathname !== '/profile') {
        router.push('/profile');
        return;
      }
      
      // requiredStatus가 active인데 사용자 상태가 active가 아닌 경우
      if (requiredStatus === 'active' && status !== 'active' && !isPublicPath) {
        switch (status) {
          case 'pending_profile':
            router.push('/signup/complete-profile');
            break;
          case 'pending_approval':
            router.push('/auth/pending-approval');
            break;
          case 'rejected':
          case 'suspended':
            router.push('/profile');
            break;
          default:
            router.push('/');
        }
        return;
      }
      
      // 모든 확인 통과, 페이지 로드 허용
      setChecking(false);
    } catch (error) {
      console.error('인증 확인 중 오류:', error);
      setChecking(false);
    }
  }, [checkAuth, isPublicPath, isAdminPath, pathname, requiredStatus, router, status]);

  // 경로 변경 또는 상태 변경 시 인증 확인
  useEffect(() => {
    // 로딩 중이면 확인 건너뛰기
    if (loading) return;
    
    verifyAuthentication();
  }, [verifyAuthentication, loading]);

  // 인증 확인 중이면 로딩 표시
  if (checking && !isPublicPath) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-900">
        <div className="text-center">
          <p className="text-xl font-semibold text-amber-400">인증 확인 중...</p>
          <p className="text-gray-400 mt-2">잠시만 기다려주세요.</p>
        </div>
      </div>
    );
  }

  // 공개 경로거나 인증 조건을 만족하면 컨텐츠 표시
  return <>{children}</>;
} 