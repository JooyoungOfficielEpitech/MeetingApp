import { Request, Response } from 'express';
import User, { Gender } from '../models/User';

// 내 프로필 조회
export const getMyProfile = async (req: Request, res: Response) => {
  try {
    // 인증 미들웨어에서 추가된 사용자 정보 사용
    const user = req.user;

    if (!user) {
      return res.status(404).json({
        success: false,
        error: '사용자를 찾을 수 없습니다.'
      });
    }

    // 필요한 프로필 정보만 추출
    const profile = {
      nickname: user.nickname,
      birthYear: user.birthYear,
      height: user.height,
      city: user.city,
      profileImages: user.profileImages,
      gender: user.gender,
      credit: user.credit
    };

    // 성별이 남성인 경우에만 명함 사진 추가
    if (user.gender === Gender.MALE && user.businessCardImage) {
      Object.assign(profile, { businessCardImage: user.businessCardImage });
    }

    res.json({
      success: true,
      profile
    });
  } catch (error) {
    console.error('프로필 조회 에러:', error);
    res.status(500).json({
      success: false,
      error: '프로필 조회 중 오류가 발생했습니다.'
    });
  }
};

// 내 프로필 수정
export const updateMyProfile = async (req: Request, res: Response) => {
  try {
    const { nickname, birthYear, height, city, profileImages } = req.body;
    
    // 인증 미들웨어에서 추가된 사용자 정보 사용
    const user = req.user;

    if (!user) {
      return res.status(404).json({
        success: false,
        error: '사용자를 찾을 수 없습니다.'
      });
    }

    // 요청에 포함된 필드만 업데이트
    if (nickname !== undefined) user.nickname = nickname;
    if (birthYear !== undefined) user.birthYear = birthYear;
    if (height !== undefined) user.height = height;
    if (city !== undefined) user.city = city;
    
    // 프로필 이미지 처리
    if (profileImages !== undefined) {
      // 프로필 이미지 개수 제한
      if (profileImages.length > 3) {
        return res.status(400).json({
          success: false,
          error: '프로필 이미지는 최대 3개까지 등록 가능합니다.'
        });
      }
      user.profileImages = profileImages;
    }

    // 명함 사진 처리 (요청에 포함된 경우)
    if (req.body.businessCardImage !== undefined) {
      // 여성 사용자는 명함 사진을 등록할 수 없음
      if (user.gender === Gender.FEMALE && req.body.businessCardImage) {
        return res.status(400).json({
          success: false,
          error: '여성 사용자는 명함 사진을 등록할 수 없습니다.'
        });
      }
      user.businessCardImage = req.body.businessCardImage;
    }

    await user.save();

    res.json({
      success: true,
      message: '프로필 수정 완료'
    });
  } catch (error) {
    console.error('프로필 수정 에러:', error);
    res.status(500).json({
      success: false,
      error: '프로필 수정 중 오류가 발생했습니다.'
    });
  }
}; 