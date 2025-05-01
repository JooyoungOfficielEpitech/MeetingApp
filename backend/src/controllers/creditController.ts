import { Request, Response } from 'express';
import User from '../models/User';
import CreditLog from '../models/CreditLog';
import { CreditService } from '../services/creditService';

const creditService = new CreditService();

// 크레딧 사용 내역 조회
export const getCreditLogs = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({ message: '인증되지 않은 사용자입니다.' });
    }

    const creditLogs = await creditService.getCreditLogs(userId);

    return res.status(200).json({
      success: true,
      data: creditLogs
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || '크레딧 사용 내역 조회 중 오류가 발생했습니다.'
    });
  }
};

// 크레딧 충전
export const chargeCredit = async (req: Request, res: Response) => {
  try {
    const { amount, description } = req.body;
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({ message: '인증되지 않은 사용자입니다.' });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: '유효한 크레딧 금액을 입력해주세요.' });
    }

    const creditLog = await creditService.chargeCredit(userId, amount, description || '크레딧 충전');

    return res.status(200).json({
      success: true,
      data: creditLog
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || '크레딧 충전 중 오류가 발생했습니다.'
    });
  }
};

// 크레딧 사용
export const useCredit = async (req: Request, res: Response) => {
  try {
    const { amount, service, description } = req.body;
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({ message: '인증되지 않은 사용자입니다.' });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: '유효한 크레딧 금액을 입력해주세요.' });
    }

    if (!service) {
      return res.status(400).json({ message: '서비스 정보가 필요합니다.' });
    }

    const creditLog = await creditService.useCredit(userId, amount, service, description || `${service} 서비스 이용`);

    return res.status(200).json({
      success: true,
      data: creditLog
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || '크레딧 사용 중 오류가 발생했습니다.'
    });
  }
};

// 크레딧 사용 정보 조회
export const getCreditUsageInfo = async (req: Request, res: Response) => {
  // 크레딧 사용 정보 (프로젝트 요구사항에 맞게 수정 필요)
  const creditUsageInfo = {
    matching: {
      description: '매칭 서비스 이용',
      cost: 10
    },
    profileUnlock: {
      description: '프로필 잠금 해제',
      cost: 5
    },
    messageBoost: {
      description: '메시지 부스트',
      cost: 3
    }
  };

  res.status(200).json({
    success: true,
    data: creditUsageInfo
  });
};

// 현재 크레딧 조회
export const getCurrentCredit = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({ message: '인증되지 않은 사용자입니다.' });
    }

    const credit = await creditService.getCurrentCredit(userId);

    return res.status(200).json({
      success: true,
      data: { credit }
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || '크레딧 조회 중 오류가 발생했습니다.'
    });
  }
}; 