import { Request, Response } from 'express';
import MatchQueue from '../models/MatchQueue';
import User from '../models/User';
import CreditLog, { CreditAction } from '../models/CreditLog';
import mongoose from 'mongoose';

// 매칭 요청 (대기열 등록)
export const requestMatch = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    
    // 매칭에 필요한 크레딧 (10개)
    const requiredCredit = 10;
    
    // 크레딧 확인
    if (user.credit < requiredCredit) {
      return res.status(400).json({
        success: false,
        error: '크레딧이 부족합니다.'
      });
    }

    // 이미 대기열에 있는지 확인
    const existingQueue = await MatchQueue.findOne({
      userId: user._id,
      isWaiting: true
    });

    if (existingQueue) {
      return res.status(400).json({
        success: false,
        error: '이미 매칭 대기열에 등록되어 있습니다.'
      });
    }

    // 크레딧 차감 및 로그 생성
    const creditLog = new CreditLog({
      userId: user._id,
      action: CreditAction.MATCH,
      amount: -requiredCredit
    });
    
    await creditLog.save();

    // 사용자 크레딧 업데이트
    user.credit -= requiredCredit;
    await user.save();

    // 매칭 대기열에 등록
    const matchQueue = new MatchQueue({
      userId: user._id,
      gender: user.gender,
      isWaiting: true
    });

    await matchQueue.save();

    res.json({
      success: true,
      message: '매칭 대기열에 등록되었습니다.'
    });
  } catch (error) {
    console.error('매칭 요청 에러:', error);
    res.status(500).json({
      success: false,
      error: '매칭 요청 중 오류가 발생했습니다.'
    });
  }
};

// 매칭 상태 확인
export const checkMatchStatus = async (req: Request, res: Response) => {
  try {
    const user = req.user;

    // 현재 대기 중인 매칭 요청 확인
    const queueEntry = await MatchQueue.findOne({
      userId: user._id,
      isWaiting: true
    });

    // 대기 중인 매칭 요청이 없는 경우
    if (!queueEntry) {
      // 최근 매칭된 결과 확인 (최근 7일 이내)
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const recentMatch = await MatchQueue.findOne({
        userId: user._id,
        isWaiting: false,
        updatedAt: { $gte: oneWeekAgo }
      }).sort({ updatedAt: -1 });

      // 최근 매칭 결과가 없는 경우
      if (!recentMatch) {
        return res.json({
          success: true,
          isWaiting: false,
          matchedUser: null
        });
      }

      // 매칭 상대 정보 조회
      // 여기서는 실제 매칭 알고리즘이 필요하지만, 예시로 간단하게 구현
      // 실제로는 매칭된 상대방의 ID를 가져와야 함
      const oppositeGender = user.gender === 'male' ? 'female' : 'male';
      const matchedUser = await User.findOne({
        gender: oppositeGender,
        _id: { $ne: user._id } // 자기 자신 제외
      }).select('_id nickname birthYear height city profileImages');

      if (!matchedUser) {
        return res.json({
          success: true,
          isWaiting: false,
          matchedUser: null
        });
      }

      // 프로필 이미지 블러 처리 (실제로는 이미지 URL 변환 필요)
      const blurredProfileImages = matchedUser.profileImages.map(img => `blurred-${img}`);

      return res.json({
        success: true,
        isWaiting: false,
        matchedUser: {
          id: matchedUser._id,
          nickname: matchedUser.nickname,
          birthYear: matchedUser.birthYear,
          height: matchedUser.height,
          city: matchedUser.city,
          profileImages: blurredProfileImages
        }
      });
    }

    // 대기 중인 경우
    return res.json({
      success: true,
      isWaiting: true,
      matchedUser: null
    });
  } catch (error) {
    console.error('매칭 상태 확인 에러:', error);
    res.status(500).json({
      success: false,
      error: '매칭 상태 확인 중 오류가 발생했습니다.'
    });
  }
};

// 매칭 요청 취소
export const cancelMatch = async (req: Request, res: Response) => {
  try {
    const user = req.user;

    // 대기 중인 매칭 요청 확인
    const queueEntry = await MatchQueue.findOne({
      userId: user._id,
      isWaiting: true
    });

    if (!queueEntry) {
      return res.status(400).json({
        success: false,
        error: '현재 대기 중인 매칭 요청이 없습니다.'
      });
    }

    // 매칭 요청 취소 (isWaiting = false로 설정)
    queueEntry.isWaiting = false;
    await queueEntry.save();

    res.json({
      success: true,
      message: '매칭 요청이 취소되었습니다.'
    });
  } catch (error) {
    console.error('매칭 취소 에러:', error);
    res.status(500).json({
      success: false,
      error: '매칭 취소 중 오류가 발생했습니다.'
    });
  }
}; 