'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import axiosInstance from '@/utils/axiosInstance';

// 사용자 상태 유형 정의
type UserStatus = 'pending_profile' | 'pending_approval' | 'active' | 'rejected' | 'suspended' | null;

// 사용자 정보 유형 정의
interface UserInfo {
  id: number | string;
  email: string;
  name?: string;
  gender?: string;
  status: UserStatus;
  rejectionReason?: string;
  isAdmin?: boolean;
}

// 로그인 응답 인터페이스 정의
interface AuthResponse {
  token: string;
  user: UserInfo;
  activeMatchId?: string | null;
}

// 프로필 응답 인터페이스 정의
interface ProfileResponse {
  user: UserInfo;
  message?: string;
}

// 인증 컨텍스트 유형 정의
interface AuthContextType {
  isAuthenticated: boolean;
  userInfo: UserInfo | null;
  status: UserStatus;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<boolean>;
  checkAuthorization: (requiredStatus?: UserStatus) => boolean;
}

// 기본값으로 컨텍스트 생성
const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  userInfo: null,
  status: null,
  loading: false,
  error: null,
  login: async () => {},
  logout: () => {},
  checkAuth: async () => false,
  checkAuthorization: () => false,
});

// 인증 컨텍스트 프로바이더 컴포넌트
export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [status, setStatus] = useState<UserStatus>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // localStorage 안전하게 접근하는 함수
  const safeLocalStorage = {
    getItem: (key: string): string | null => {
      try {
        return typeof window !== 'undefined' ? localStorage.getItem(key) : null;
      } catch (e) {
        console.error('localStorage.getItem 오류:', e);
        return null;
      }
    },
    setItem: (key: string, value: string): void => {
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem(key, value);
        }
      } catch (e) {
        console.error('localStorage.setItem 오류:', e);
      }
    },
    removeItem: (key: string): void => {
      try {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(key);
        }
      } catch (e) {
        console.error('localStorage.removeItem 오류:', e);
      }
    }
  };

  // 인증 상태 확인 함수 - useCallback으로 감싸서 의존성 문제 해결
  const checkAuth = useCallback(async (): Promise<boolean> => {
    const token = safeLocalStorage.getItem('token');
    
    if (!token) {
      console.log('인증 확인: 토큰 없음');
      setIsAuthenticated(false);
      setUserInfo(null);
      setStatus(null);
      return false;
    }

    try {
      console.log('인증 확인: 프로필 데이터 요청 중');
      const response = await axiosInstance.get<any>('/api/profile/me');
      console.log('인증 확인: 응답 데이터 구조:', JSON.stringify(response.data));
      
      // API 응답 구조에 따라 유연하게 사용자 데이터 추출
      let userData: UserInfo | null = null;
      
      // 케이스 1: response.data가 UserInfo 객체 자체인 경우 (id, email, status 등을 직접 포함)
      if (response.data && response.data.id && response.data.email) {
        console.log('인증 확인: 응답이 직접 사용자 데이터 포함');
        userData = response.data;
      } 
      // 케이스 2: response.data.user에 UserInfo 객체가 있는 경우 (일반적인 케이스)
      else if (response.data && response.data.user && response.data.user.id) {
        console.log('인증 확인: 응답이 user 객체에 데이터 포함');
        userData = response.data.user;
      }
      // 케이스 3: 다른 구조인 경우 (추가 예외 처리)
      else {
        console.error('인증 확인: 알 수 없는 응답 구조', response.data);
        safeLocalStorage.removeItem('token');
        setIsAuthenticated(false);
        setUserInfo(null);
        setStatus(null);
        return false;
      }
      
      // 사용자 데이터 유효성 확인
      if (!userData || !userData.id || !userData.email) {
        console.error('인증 확인: 불완전한 사용자 데이터', userData);
        safeLocalStorage.removeItem('token');
        setIsAuthenticated(false);
        setUserInfo(null);
        setStatus(null);
        return false;
      }
      
      console.log('인증 확인: 유효한 사용자 데이터 확인됨', userData);
      
      // 상태 업데이트
      setIsAuthenticated(true);
      
      // root@root.com은 항상 관리자로 설정
      if (userData.email === 'root@root.com') {
        console.log('인증 확인: root 계정 감지, 관리자 권한 부여');
        userData.isAdmin = true;
      }
      
      setUserInfo(userData);
      
      // status 필드가 있으면 사용, 없으면 기본값 'active'로 설정
      const userStatus = userData.status || 'active';
      setStatus(userStatus as UserStatus);
      
      // 로컬 스토리지 업데이트
      safeLocalStorage.setItem('user', userStatus as string);
      if (userData.id) {
        safeLocalStorage.setItem('userId', userData.id.toString());
      }
      
      // 관리자 권한이 있거나 root@root.com이면 isAdmin 저장
      if (userData.isAdmin || userData.email === 'root@root.com') {
        console.log('인증 확인: 관리자 권한 저장');
        safeLocalStorage.setItem('isAdmin', 'true');
      }
      
      console.log('인증 확인: 완료', { status: userStatus });
      return true;
    } catch (err: any) {
      console.error('인증 확인 오류:', err);
      console.log('응답 상태 코드:', err.response?.status);
      console.log('응답 데이터:', err.response?.data);
      
      // 토큰이 만료되었거나 유효하지 않은 경우
      if (err.response?.status === 401 || err.response?.status === 403) {
        console.log('인증 확인: 토큰 무효화, 로그아웃 처리');
        safeLocalStorage.removeItem('token');
        safeLocalStorage.removeItem('user');
        safeLocalStorage.removeItem('userId');
        safeLocalStorage.removeItem('isAdmin');
        setIsAuthenticated(false);
        setUserInfo(null);
        setStatus(null);
      }
      
      return false;
    }
  }, []);

  // 컴포넌트 마운트 시 인증 확인 - checkAuth가 이제 useCallback으로 감싸져 있음
  useEffect(() => {
    const initAuth = async () => {
      await checkAuth();
      setLoading(false);
    };
    initAuth();
  }, [checkAuth]);

  // 로그인 함수
  const login = async (email: string, password: string): Promise<void> => {
    setLoading(true);
    setError(null);
    
    try {
      // 일반 사용자 로그인 처리
      console.log('일반 사용자 로그인 요청 시작:', { email });
      const response = await axiosInstance.post<AuthResponse>('/api/auth/login', { email, password });
      console.log('로그인 응답 데이터:', response.data);
      
      // 토큰 저장
      if (response.data.token) {
        console.log('토큰 저장');
        safeLocalStorage.setItem('token', response.data.token);
        
        // 사용자 정보 저장
        if (response.data.user) {
          if (response.data.user.id) {
            console.log('사용자 ID 저장:', response.data.user.id);
            safeLocalStorage.setItem('userId', response.data.user.id.toString());
          }
          if (response.data.user.status) {
            console.log('사용자 상태 저장:', response.data.user.status);
            safeLocalStorage.setItem('user', response.data.user.status);
          }
          
          // root@root.com은 항상 관리자로 설정
          if (response.data.user.email === 'root@root.com') {
            console.log('로그인: root 계정 감지, 관리자 권한 부여');
            response.data.user.isAdmin = true;
          }
          
          // DB에서 isAdmin 정보가 있으면 저장
          if (response.data.user.isAdmin || response.data.user.email === 'root@root.com') {
            console.log('관리자 권한 저장');
            safeLocalStorage.setItem('isAdmin', 'true');
          }
        }
        
        setIsAuthenticated(true);
        setUserInfo(response.data.user);
        setStatus(response.data.user.status as UserStatus);
        
        // 사용자 상태에 따른 리디렉션
        console.log('로그인 성공, 리디렉션 준비:', response.data.user.status);
        
        // 관리자인 경우 바로 관리자 페이지로 리디렉션
        if (response.data.user.isAdmin) {
          console.log('관리자 계정으로 로그인: 관리자 페이지로 리디렉션');
          router.push('/admin');
          return;
        }
        
        // 상태 값이 없거나 undefined면 기본값 active 사용
        const userStatus = response.data.user.status || 'active';
        handleStatusRedirection(userStatus as UserStatus);
      } else {
        // 토큰이 없는 경우 (드문 경우지만 대비)
        console.error('로그인 응답에 토큰이 없음:', response.data);
        setError('로그인에 실패했습니다. 토큰 정보 누락');
      }
    } catch (err: any) {
      console.error('로그인 오류 발생:', err);
      console.log('오류 응답:', err.response);
      
      // 권한 오류(403)의 경우 사용자 상태 관련 문제
      if (err.response?.status === 403) {
        const errorMessage = err.response.data.message || '';
        console.log('403 오류 메시지:', errorMessage);
        
        // 승인 대기 중인 경우
        if (errorMessage.includes('pending')) {
          console.log('승인 대기 상태로 설정');
          setStatus('pending_approval');
          safeLocalStorage.setItem('user', 'pending_approval');
          router.push('/auth/pending-approval');
        } 
        // 거부된 경우
        else if (errorMessage.includes('rejected')) {
          console.log('거부 상태로 설정');
          setStatus('rejected');
          safeLocalStorage.setItem('user', 'rejected');
          router.push('/profile');
        } 
        // 정지된 경우
        else if (errorMessage.includes('suspended')) {
          console.log('정지 상태로 설정');
          setStatus('suspended');
          safeLocalStorage.setItem('user', 'suspended');
          router.push('/profile');
        }
      }
      
      setError(err.response?.data?.message || '로그인 중 오류가 발생했습니다.');
      throw err; // 에러 다시 던지기
    } finally {
      setLoading(false);
    }
  };

  // 로그아웃 함수
  const logout = () => {
    safeLocalStorage.removeItem('token');
    safeLocalStorage.removeItem('user');
    safeLocalStorage.removeItem('userId');
    setIsAuthenticated(false);
    setUserInfo(null);
    setStatus(null);
    router.push('/');
  };

  // 사용자 상태에 따른 리디렉션 처리
  const handleStatusRedirection = (userStatus: UserStatus) => {
    console.log('상태 기반 리디렉션 실행:', userStatus);
    
    // 관리자인 경우 (userInfo가 null이 아니고 isAdmin이 true인 경우)
    if (userInfo && userInfo.isAdmin) {
      console.log('관리자 계정 감지: 관리자 페이지로 리디렉션');
      router.push('/admin');
      return;
    }
    
    // 일반 사용자인 경우 상태에 따라 리디렉션
    switch (userStatus) {
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
      case 'active':
        router.push('/main');
        break;
      default:
        router.push('/');
    }
  };

  // 사용자 권한 확인 함수
  const checkAuthorization = (requiredStatus: UserStatus = 'active'): boolean => {
    // 로그인 되어 있지 않으면 권한 없음
    if (!isAuthenticated || !status) {
      return false;
    }
    
    // 'active' 상태가 필요하고 사용자 상태가 'active'인 경우
    if (requiredStatus === 'active' && status === 'active') {
      return true;
    }
    
    // 특정 상태가 필요하고 사용자가 그 상태인 경우
    if (requiredStatus && status === requiredStatus) {
      return true;
    }
    
    return false;
  };

  // 컨텍스트 값
  const contextValue: AuthContextType = {
    isAuthenticated,
    userInfo,
    status,
    loading,
    error,
    login,
    logout,
    checkAuth,
    checkAuthorization,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// 인증 컨텍스트 사용을 위한 커스텀 훅
export const useAuth = () => useContext(AuthContext); 