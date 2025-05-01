import React, { useState, ChangeEvent, FormEvent } from 'react';
import styles from './Login.module.css';
import amieLogo from '../../assets/amie_logo.png'; // Import the logo
// Import strings
import * as AppStrings from '../../constants/strings';

// Kakao Icon SVG Component
const KakaoIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
        <path d="M8 15c4.418 0 8-3.134 8-7s-3.582-7-8-7-8 3.134-8 7c0 1.76.743 3.37 1.97 4.6-.097 1.016-.417 2.13-.771 2.966-.079.186.074.394.273.362 2.256-.37 3.597-.938 4.18-1.234A9 9 0 0 0 8 15"/>
    </svg>
);

// Define props for Login component
interface LoginProps {
    onLoginSuccess: () => void;
    onStartSignup: () => void; // 회원가입 시작 콜백 추가
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess, onStartSignup }) => {
    // const navigate = useNavigate(); // useNavigate 제거
    const [email, setEmail] = useState<string>('');
    const [password, setPassword] = useState<string>('');
    const [rememberMe, setRememberMe] = useState<boolean>(false);

    // Type the event handlers
    const handleEmailChange = (event: ChangeEvent<HTMLInputElement>) => {
        setEmail(event.target.value);
    };

    const handlePasswordChange = (event: ChangeEvent<HTMLInputElement>) => {
        setPassword(event.target.value);
    };

    const handleRememberMeChange = (event: ChangeEvent<HTMLInputElement>) => {
        setRememberMe(event.target.checked);
    };

    const handleEmailLogin = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        console.log('Mock Email Login Attempt:', { email, password, rememberMe });
        onLoginSuccess();
    };

    const handleGoogleLogin = () => {
        console.log('Mock Google Sign-in Attempt');
        onLoginSuccess();
    };

    const handleKakaoLogin = () => {
        console.log('Mock Kakao Continue Attempt');
        onLoginSuccess();
    };

    // --- 회원가입 시작 핸들러 ---
    const handleStartSignupClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
        event.preventDefault(); // 기본 동작 방지
        onStartSignup(); // 부모 컴포넌트(App)에 알림
    };

    return (
        <div className={styles.loginContainer}>
            <img src={amieLogo} alt="Amié Logo" className={styles.logo} />
            <p className={styles.subtitle}>{AppStrings.LOGIN_SUBTITLE}</p>

            <form onSubmit={handleEmailLogin}>
                <input
                    type="email"
                    placeholder={AppStrings.LOGIN_EMAIL_PLACEHOLDER}
                    value={email}
                    onChange={handleEmailChange}
                    required
                    className={styles.inputField}
                />
                <input
                    type="password"
                    placeholder={AppStrings.LOGIN_PASSWORD_PLACEHOLDER}
                    value={password}
                    onChange={handlePasswordChange}
                    required
                    className={styles.inputField}
                />

                <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
                    {AppStrings.LOGIN_BUTTON_EMAIL}
                </button>

                <div className={styles.options}>
                    <label className={styles.rememberMe}>
                        <input
                            type="checkbox"
                            checked={rememberMe}
                            onChange={handleRememberMeChange}
                        /> {AppStrings.LOGIN_REMEMBER_ME}
                    </label>
                    <a href="#" className={styles.forgotPassword}>{AppStrings.LOGIN_FORGOT_PASSWORD}</a>
                </div>
            </form>

            <div className={styles.separator}>
                <hr />
                <span>{AppStrings.LOGIN_SEPARATOR_TEXT}</span>
                <hr />
            </div>

            <button type="button" onClick={handleGoogleLogin} className={`${styles.btn} ${styles.btnSecondary} ${styles.btnGoogle}`}>
                <img src="https://img.icons8.com/color/16/000000/google-logo.png" alt="Google logo" />
                {AppStrings.LOGIN_BUTTON_GOOGLE}
            </button>
            <button type="button" onClick={handleKakaoLogin} className={`${styles.btn} ${styles.btnSecondary} ${styles.btnKakao}`}>
                <KakaoIcon />
                {AppStrings.LOGIN_BUTTON_KAKAO}
            </button>

            <p className={styles.signupLink}>
                {AppStrings.LOGIN_SIGNUP_PROMPT} <a href="#" onClick={handleStartSignupClick}>{AppStrings.LOGIN_SIGNUP_LINK}</a>
            </p>

            <p className={styles.footerText}>
                {AppStrings.LOGIN_TERMS_AGREEMENT_PREFIX} <a href="#">{AppStrings.LOGIN_TERMS_LINK}</a>. 
                {AppStrings.LOGIN_PRIVACY_AGREEMENT_PREFIX} <a href="#">{AppStrings.LOGIN_PRIVACY_LINK}</a>.
            </p>
        </div>
    );
}

export default Login; 