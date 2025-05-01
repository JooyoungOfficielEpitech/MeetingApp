import { useState } from 'react';
import Login from './components/Login/Login';
import MainPage from './components/MainPage/MainPage';
import ChatPage from './components/ChatPage/ChatPage';
import MyProfile from './components/MyProfile/MyProfile';
import Settings from './components/Settings/Settings';
import SignupFlow from './components/SignupFlow/SignupFlow';
import { SignupData } from './types';
import './App.css';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [activeView, setActiveView] = useState<'dashboard' | 'chat' | 'my-profile' | 'settings'>('dashboard');
  const [showSignupFlow, setShowSignupFlow] = useState<boolean>(false);

  // Function to handle successful login
  const handleLoginSuccess = () => {
    console.log("Login Success triggered!"); // Log for debugging
    setIsLoggedIn(true);
    setActiveView('dashboard'); // Default to dashboard after login
    setShowSignupFlow(false); // 로그인 성공 시 회원가입 플로우 숨김
  };

  // Function to handle starting the signup process
  const handleStartSignup = () => {
    console.log("Start Signup triggered!");
    setIsLoggedIn(true); // 로그인 상태로 변경하여 MainPage 배경 보이도록 함
    setShowSignupFlow(true); // 회원가입 플로우 표시
    setActiveView('dashboard'); // 배경으로 기본 대시보드 보이도록 설정
  };

  // Function to handle signup completion
  const handleSignupComplete = (finalData: SignupData) => {
      console.log("Signup Complete in App:", finalData);
      // TODO: 실제 회원가입 API 호출
      alert("Signup Success! Please log in."); // 임시 알림
      setShowSignupFlow(false); // 회원가입 플로우 숨김
      setIsLoggedIn(false); // 로그인 페이지로 돌아가도록 로그아웃 상태로 설정 (선택 사항)
      setActiveView('dashboard'); // 또는 로그인 페이지로 리디렉션 필요
  };

  // Function to cancel/close signup flow
  const handleCloseSignup = () => {
      console.log("Signup Flow Closed/Cancelled");
      setShowSignupFlow(false); // 회원가입 플로우 숨김
      setIsLoggedIn(false); // 로그인 상태 다시 false로 변경
      // 필요하다면 activeView 초기화
      // setActiveView('dashboard'); 
  }

  // Function to handle logout
  const handleLogout = () => {
      console.log("Logout triggered!"); // Log for debugging
      setIsLoggedIn(false);
      setShowSignupFlow(false); // 로그아웃 시 회원가입 플로우도 숨김
  };

  // Navigation functions
  const navigateToChat = () => {
      if (isLoggedIn) setActiveView('chat');
  };

  const navigateToDashboard = () => {
      if (isLoggedIn) setActiveView('dashboard');
  };

  // New navigation function for My Profile
  const navigateToMyProfile = () => {
      if (isLoggedIn) setActiveView('my-profile');
  };

  // New navigation function for Settings
  const navigateToSettings = () => {
      if (isLoggedIn) setActiveView('settings');
  };

  // Helper function to render the active component
  const renderActiveView = () => {
      switch (activeView) {
          case 'dashboard':
              return <MainPage 
                          onLogout={handleLogout} 
                          onNavigateToChat={navigateToChat} 
                          onNavigateToMyProfile={navigateToMyProfile}
                          onNavigateToSettings={navigateToSettings}
                          currentView={activeView}
                      />;
          case 'chat':
              return <ChatPage 
                          onLogout={handleLogout} 
                          onNavigateToDashboard={navigateToDashboard} 
                          onNavigateToMyProfile={navigateToMyProfile}
                          onNavigateToSettings={navigateToSettings}
                          currentView={activeView}
                      />;
          case 'my-profile':
              return <MyProfile 
                          onNavigateToDashboard={navigateToDashboard}
                          onLogout={handleLogout}
                          onNavigateToMyProfile={navigateToMyProfile}
                          onNavigateToSettings={navigateToSettings}
                          currentView={activeView}
                      />; 
          case 'settings':
              return <Settings 
                          onNavigateToDashboard={navigateToDashboard}
                          onLogout={handleLogout}
                          onNavigateToMyProfile={navigateToMyProfile}
                          onNavigateToSettings={navigateToSettings}
                          currentView={activeView}
                      />;
          default:
              return <MainPage 
                          onLogout={handleLogout} 
                          onNavigateToChat={navigateToChat} 
                          onNavigateToMyProfile={navigateToMyProfile} 
                          onNavigateToSettings={navigateToSettings}
                          currentView={activeView}
                       />;
      }
  };

  return (
    <>
      {/* 기본 뷰 렌더링: 로그인 상태에 따라 Login 또는 MainPage 등 */}
      {isLoggedIn
        ? renderActiveView()
        : <div className="loginPageContainer">
            <Login 
              onLoginSuccess={handleLoginSuccess} 
              onStartSignup={handleStartSignup}
            />
          </div>
      }

      {/* 회원가입 플로우 오버레이: showSignupFlow가 true일 때만 렌더링 */}
      {showSignupFlow && (
          // SignupFlow 컴포넌트는 내부에 modal overlay를 포함하고 있음
          <SignupFlow 
              isOpen={true} // 항상 true로 전달 (렌더링 자체는 showSignupFlow로 제어)
              onClose={handleCloseSignup} 
              onComplete={handleSignupComplete}
          />
      )}
    </>
  );
}

export default App;