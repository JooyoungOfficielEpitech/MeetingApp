import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser, Gender, SocialProvider } from '../models/User';
import axios from 'axios';

// JWT 토큰 생성
const generateToken = (id: string, email: string | undefined) => {
  return jwt.sign(
    { id, email },
    process.env.JWT_SECRET || 'user-secret-key',
    { expiresIn: '7d' }
  );
};

// 회원가입
export const register = async (req: Request, res: Response) => {
  try {
    const {
      email,
      password,
      nickname,
      birthYear,
      height,
      city,
      gender,
      profileImages,
      businessCardImage
    } = req.body;

    // 이메일 필수 확인
    if (!email) {
      return res.status(400).json({
        success: false,
        error: '이메일은 필수 항목입니다.'
      });
    }

    // 이메일 중복 확인
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        success: false,
        error: '이미 존재하는 이메일입니다.'
      });
    }

    // 비밀번호 필수 확인
    if (!password) {
      return res.status(400).json({
        success: false,
        error: '비밀번호는 필수 항목입니다.'
      });
    }

    // 필수 필드 확인
    if (!nickname || !birthYear || !height || !city || !gender || !profileImages) {
      return res.status(400).json({
        success: false,
        error: '필수 정보가 누락되었습니다.'
      });
    }

    // 성별에 따른 명함 사진 유효성 검사
    if (gender === Gender.FEMALE && businessCardImage) {
      return res.status(400).json({
        success: false,
        error: '여성 사용자는 명함 사진을 등록할 수 없습니다.'
      });
    }

    // 프로필 이미지 개수 제한
    if (profileImages.length > 3) {
      return res.status(400).json({
        success: false,
        error: '프로필 이미지는 최대 3개까지 등록 가능합니다.'
      });
    }

    // 새 사용자 생성
    const user = new User({
      email,
      passwordHash: password, // 저장 시 모델의 pre 훅에서 해싱됨
      nickname,
      birthYear,
      height,
      city,
      gender,
      profileImages,
      businessCardImage: gender === Gender.MALE ? businessCardImage : undefined,
      credit: 50, // 초기 크레딧 50으로 설정
      socialProvider: SocialProvider.LOCAL
    });

    const savedUser = await user.save();

    // 성공 응답
    res.status(201).json({
      success: true,
      message: '회원가입 완료',
      userId: savedUser._id
    });
  } catch (error) {
    console.error('회원가입 에러:', error);
    res.status(500).json({
      success: false,
      error: '회원가입 중 오류가 발생했습니다.'
    });
  }
};

// 로그인
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // 이메일, 비밀번호 필수 확인
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: '이메일과 비밀번호는 필수 항목입니다.'
      });
    }

    // 사용자 조회
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        error: '이메일 또는 비밀번호가 잘못되었습니다.'
      });
    }

    // 소셜 로그인 사용자 확인
    if (user.socialProvider !== SocialProvider.LOCAL) {
      return res.status(400).json({
        success: false,
        error: `${user.socialProvider} 계정으로 가입하셨습니다. 소셜 로그인을 이용해주세요.`
      });
    }

    // 비밀번호 확인
    const isPasswordMatch = await user.comparePassword(password);
    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        error: '이메일 또는 비밀번호가 잘못되었습니다.'
      });
    }

    // JWT 토큰 생성
    const token = generateToken(user._id, user.email);

    // 성공 응답
    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        nickname: user.nickname,
        gender: user.gender,
        credit: user.credit
      }
    });
  } catch (error) {
    console.error('로그인 에러:', error);
    res.status(500).json({
      success: false,
      error: '로그인 중 오류가 발생했습니다.'
    });
  }
};

// 소셜 로그인
export const socialLogin = async (req: Request, res: Response) => {
  try {
    const { provider, token } = req.body;

    // 필수 파라미터 확인
    if (!provider || !token) {
      return res.status(400).json({
        success: false,
        error: '제공자와 토큰은 필수 항목입니다.'
      });
    }

    // 소셜 로그인 제공자 확인
    if (![SocialProvider.GOOGLE, SocialProvider.KAKAO].includes(provider)) {
      return res.status(400).json({
        success: false,
        error: '지원하지 않는 소셜 로그인입니다.'
      });
    }

    let socialId = '';
    let socialEmail = '';
    
    // 소셜 제공자별 처리
    if (provider === SocialProvider.GOOGLE) {
      // Google 토큰 검증
      try {
        const googleResponse = await axios.get(
          `https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=${token}`
        );
        socialId = googleResponse.data.sub;
        socialEmail = googleResponse.data.email;
      } catch (error) {
        return res.status(401).json({
          success: false,
          error: '유효하지 않은 Google 토큰입니다.'
        });
      }
    } else if (provider === SocialProvider.KAKAO) {
      // Kakao 토큰 검증
      try {
        const kakaoResponse = await axios.get('https://kapi.kakao.com/v2/user/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        socialId = String(kakaoResponse.data.id);
        socialEmail = kakaoResponse.data.kakao_account?.email;
      } catch (error) {
        return res.status(401).json({
          success: false,
          error: '유효하지 않은 Kakao 토큰입니다.'
        });
      }
    }

    // 소셜 ID 확인
    if (!socialId) {
      return res.status(401).json({
        success: false,
        error: '소셜 계정 정보를 가져올 수 없습니다.'
      });
    }

    // 사용자 조회 - 소셜 ID와 제공자로 사용자 검색
    let user = await User.findOne({ 
      email: socialEmail, 
      socialProvider: provider 
    });

    // 사용자가 없는 경우 - 회원가입 필요
    if (!user) {
      return res.status(404).json({
        success: false,
        error: '사용자 정보가 없습니다. 회원가입이 필요합니다.',
        socialId,
        socialEmail,
        provider
      });
    }

    // JWT 토큰 생성
    const jwtToken = generateToken(user._id, user.email);

    // 성공 응답
    res.json({
      success: true,
      token: jwtToken,
      user: {
        id: user._id,
        nickname: user.nickname,
        gender: user.gender,
        credit: user.credit
      }
    });
  } catch (error) {
    console.error('소셜 로그인 에러:', error);
    res.status(500).json({
      success: false,
      error: '소셜 로그인 중 오류가 발생했습니다.'
    });
  }
};

// 소셜 회원가입
export const socialRegister = async (req: Request, res: Response) => {
  try {
    const {
      provider,
      socialEmail,
      nickname,
      birthYear,
      height,
      city,
      gender,
      profileImages,
      businessCardImage
    } = req.body;

    // 필수 필드 확인
    if (!provider || !nickname || !birthYear || !height || !city || !gender || !profileImages) {
      return res.status(400).json({
        success: false,
        error: '필수 정보가 누락되었습니다.'
      });
    }

    // 성별에 따른 명함 사진 유효성 검사
    if (gender === Gender.FEMALE && businessCardImage) {
      return res.status(400).json({
        success: false,
        error: '여성 사용자는 명함 사진을 등록할 수 없습니다.'
      });
    }

    // 프로필 이미지 개수 제한
    if (profileImages.length > 3) {
      return res.status(400).json({
        success: false,
        error: '프로필 이미지는 최대 3개까지 등록 가능합니다.'
      });
    }

    // 사용자 중복 확인
    if (socialEmail) {
      const existingUser = await User.findOne({ email: socialEmail });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: '이미 가입된 이메일입니다.'
        });
      }
    }

    // 새 사용자 생성
    const user = new User({
      email: socialEmail,
      nickname,
      birthYear,
      height,
      city,
      gender,
      profileImages,
      businessCardImage: gender === Gender.MALE ? businessCardImage : undefined,
      credit: 50, // 초기 크레딧 50으로 설정
      socialProvider: provider
    });

    const savedUser = await user.save();

    // JWT 토큰 생성
    const token = generateToken(savedUser._id, savedUser.email);

    // 성공 응답
    res.status(201).json({
      success: true,
      token,
      user: {
        id: savedUser._id,
        nickname: savedUser.nickname,
        gender: savedUser.gender,
        credit: savedUser.credit
      }
    });
  } catch (error) {
    console.error('소셜 회원가입 에러:', error);
    res.status(500).json({
      success: false,
      error: '소셜 회원가입 중 오류가 발생했습니다.'
    });
  }
}; 