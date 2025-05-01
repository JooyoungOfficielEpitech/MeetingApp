import { Request, Response } from 'express';
import User, { IUser, Gender, SocialProvider } from '../models/User';
import bcrypt from 'bcrypt';

// 새 사용자 생성
export const createUser = async (req: Request, res: Response) => {
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
      businessCardImage,
      socialProvider = SocialProvider.LOCAL
    } = req.body;

    // 이메일이 필요한 경우 확인 (소셜 로그인이 아닌 경우)
    if (socialProvider === SocialProvider.LOCAL && !email) {
      return res.status(400).json({ message: '로컬 회원가입 시 이메일이 필요합니다.' });
    }

    // 이메일 중복 확인 (이메일이 있는 경우만)
    if (email) {
      const userExists = await User.findOne({ email });
      if (userExists) {
        return res.status(400).json({ message: '이미 등록된 이메일입니다.' });
      }
    }

    // 비밀번호 확인 (소셜 로그인이 아닌 경우)
    if (socialProvider === SocialProvider.LOCAL && !password) {
      return res.status(400).json({ message: '비밀번호가 필요합니다.' });
    }

    // 필수 필드 확인
    if (!nickname || !birthYear || !height || !city || !gender || !profileImages) {
      return res.status(400).json({ message: '필수 정보가 누락되었습니다.' });
    }

    // 성별에 따른 명함 사진 유효성 검사
    if (gender === Gender.FEMALE && businessCardImage) {
      return res.status(400).json({ message: '여성 사용자는 명함 사진을 등록할 수 없습니다.' });
    }

    // 프로필 이미지 개수 제한
    if (profileImages.length > 3) {
      return res.status(400).json({ message: '프로필 이미지는 최대 3개까지 등록 가능합니다.' });
    }

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
      credit: 0,
      socialProvider
    });

    const savedUser = await user.save();

    res.status(201).json({
      _id: savedUser._id,
      email: savedUser.email,
      nickname: savedUser.nickname,
      gender: savedUser.gender,
      socialProvider: savedUser.socialProvider,
      createdAt: savedUser.createdAt
    });
  } catch (error) {
    console.error('사용자 생성 에러:', error);
    res.status(500).json({ message: '사용자 생성 중 오류가 발생했습니다.' });
  }
};

// 사용자 목록 조회
export const getUsers = async (_req: Request, res: Response) => {
  try {
    const users = await User.find().select('-passwordHash');
    res.json(users);
  } catch (error) {
    console.error('사용자 목록 조회 에러:', error);
    res.status(500).json({ message: '사용자 목록 조회 중 오류가 발생했습니다.' });
  }
};

// 사용자 상세 조회
export const getUserById = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id).select('-passwordHash');
    
    if (!user) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    res.json(user);
  } catch (error) {
    console.error('사용자 조회 에러:', error);
    res.status(500).json({ message: '사용자 조회 중 오류가 발생했습니다.' });
  }
};

// 사용자 정보 업데이트
export const updateUser = async (req: Request, res: Response) => {
  try {
    const {
      nickname,
      birthYear,
      height,
      city,
      profileImages,
      businessCardImage
    } = req.body;

    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    // 성별에 따른 명함 사진 유효성 검사
    if (user.gender === Gender.FEMALE && businessCardImage) {
      return res.status(400).json({ message: '여성 사용자는 명함 사진을 등록할 수 없습니다.' });
    }

    // 프로필 이미지 개수 제한
    if (profileImages && profileImages.length > 3) {
      return res.status(400).json({ message: '프로필 이미지는 최대 3개까지 등록 가능합니다.' });
    }

    // 필드 업데이트
    if (nickname) user.nickname = nickname;
    if (birthYear) user.birthYear = birthYear;
    if (height) user.height = height;
    if (city) user.city = city;
    if (profileImages) user.profileImages = profileImages;
    if (user.gender === Gender.MALE && businessCardImage !== undefined) {
      user.businessCardImage = businessCardImage;
    }

    const updatedUser = await user.save();

    res.json({
      _id: updatedUser._id,
      email: updatedUser.email,
      nickname: updatedUser.nickname,
      birthYear: updatedUser.birthYear,
      height: updatedUser.height,
      city: updatedUser.city,
      gender: updatedUser.gender,
      profileImages: updatedUser.profileImages,
      businessCardImage: updatedUser.businessCardImage,
      credit: updatedUser.credit,
      socialProvider: updatedUser.socialProvider,
      updatedAt: updatedUser.updatedAt
    });
  } catch (error) {
    console.error('사용자 업데이트 에러:', error);
    res.status(500).json({ message: '사용자 업데이트 중 오류가 발생했습니다.' });
  }
};

// 사용자 삭제
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    await user.deleteOne();
    
    res.json({ message: '사용자가 삭제되었습니다.' });
  } catch (error) {
    console.error('사용자 삭제 에러:', error);
    res.status(500).json({ message: '사용자 삭제 중 오류가 발생했습니다.' });
  }
};

// 크레딧 충전
export const addCredit = async (req: Request, res: Response) => {
  try {
    const { amount } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: '유효한 충전 금액을 입력해주세요.' });
    }

    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    user.credit += amount;
    const updatedUser = await user.save();

    res.json({
      _id: updatedUser._id,
      credit: updatedUser.credit,
      message: `${amount}원이 충전되었습니다. 현재 잔액: ${updatedUser.credit}원`
    });
  } catch (error) {
    console.error('크레딧 충전 에러:', error);
    res.status(500).json({ message: '크레딧 충전 중 오류가 발생했습니다.' });
  }
}; 