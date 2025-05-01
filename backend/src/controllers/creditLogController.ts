import { Request, Response } from 'express';
import CreditLog, { CreditAction, ICreditLog } from '../models/CreditLog';
import User from '../models/User';
import mongoose from 'mongoose';

// 크레딧 사용/충전 로그 생성 및 사용자 크레딧 업데이트
export const createCreditLog = async (req: Request, res: Response) => {
  try {
    const { userId, action, amount } = req.body;

    // 유효성 검사
    if (!userId || !action || amount === undefined) {
      return res.status(400).json({ message: '사용자 ID, 작업 유형, 크레딧 수량은 필수 항목입니다.' });
    }

    // 액션 유효성 검사
    if (!Object.values(CreditAction).includes(action as CreditAction)) {
      return res.status(400).json({ 
        message: '유효하지 않은 작업 유형입니다. 유효한 작업 유형: ' + Object.values(CreditAction).join(', ') 
      });
    }

    // 수량 유효성 검사 (액션에 따라 양수/음수 확인)
    if (action === CreditAction.CHARGE && amount <= 0) {
      return res.status(400).json({ message: '충전 수량은 양수여야 합니다.' });
    }
    if ((action === CreditAction.MATCH || action === CreditAction.PROFILE_UNLOCK) && amount >= 0) {
      return res.status(400).json({ message: '사용 수량은 음수여야 합니다.' });
    }

    // 사용자 존재 확인
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    // 크레딧 사용 시 잔액 확인
    if (action !== CreditAction.CHARGE) {
      if (user.credit + amount < 0) { // amount는 음수일 것임
        return res.status(400).json({ message: '크레딧 잔액이 부족합니다.' });
      }
    }

    try {
      // 크레딧 로그 생성
      const creditLog = new CreditLog({
        userId,
        action,
        amount
      });
      await creditLog.save();

      // 사용자 크레딧 업데이트
      user.credit += amount;
      await user.save();

      res.status(201).json({
        message: '크레딧 로그가 생성되었습니다.',
        creditLog,
        updatedCredit: user.credit
      });
    } catch (error) {
      throw error;
    }
  } catch (error) {
    console.error('크레딧 로그 생성 에러:', error);
    res.status(500).json({ message: '크레딧 로그 생성 중 오류가 발생했습니다.' });
  }
};

// 사용자의 크레딧 로그 조회
export const getUserCreditLogs = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    // 페이지와 제한 숫자로 변환
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);

    // 사용자 존재 확인
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    // 로그 총 개수
    const totalLogs = await CreditLog.countDocuments({ userId });

    // 로그 조회 (최신순)
    const logs = await CreditLog.find({ userId })
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    res.json({
      totalLogs,
      totalPages: Math.ceil(totalLogs / limitNum),
      currentPage: pageNum,
      logs,
      currentCredit: user.credit
    });
  } catch (error) {
    console.error('크레딧 로그 조회 에러:', error);
    res.status(500).json({ message: '크레딧 로그 조회 중 오류가 발생했습니다.' });
  }
};

// 특정 크레딧 로그 조회
export const getCreditLog = async (req: Request, res: Response) => {
  try {
    const { logId } = req.params;

    const log = await CreditLog.findById(logId);
    if (!log) {
      return res.status(404).json({ message: '존재하지 않는 크레딧 로그입니다.' });
    }

    res.json(log);
  } catch (error) {
    console.error('크레딧 로그 조회 에러:', error);
    res.status(500).json({ message: '크레딧 로그 조회 중 오류가 발생했습니다.' });
  }
};

// 크레딧 충전
export const chargeCredit = async (req: Request, res: Response) => {
  try {
    const { userId, amount } = req.body;

    // 유효성 검사
    if (!userId || !amount || amount <= 0) {
      return res.status(400).json({ message: '사용자 ID와 양수 금액이 필요합니다.' });
    }

    // 로그 생성 및 사용자 크레딧 업데이트를 위해 createCreditLog 호출
    req.body.action = CreditAction.CHARGE;
    await createCreditLog(req, res);
  } catch (error) {
    console.error('크레딧 충전 에러:', error);
    res.status(500).json({ message: '크레딧 충전 중 오류가 발생했습니다.' });
  }
};

// 매칭에 크레딧 사용
export const useMatchCredit = async (req: Request, res: Response) => {
  try {
    const { userId, amount } = req.body;

    // 유효성 검사 (amount는 음수여야 함)
    if (!userId || !amount || amount >= 0) {
      return res.status(400).json({ message: '사용자 ID와 음수 금액이 필요합니다.' });
    }

    // 로그 생성 및 사용자 크레딧 업데이트를 위해 createCreditLog 호출
    req.body.action = CreditAction.MATCH;
    await createCreditLog(req, res);
  } catch (error) {
    console.error('매칭 크레딧 사용 에러:', error);
    res.status(500).json({ message: '매칭 크레딧 사용 중 오류가 발생했습니다.' });
  }
};

// 프로필 잠금해제에 크레딧 사용
export const useProfileUnlockCredit = async (req: Request, res: Response) => {
  try {
    const { userId, amount } = req.body;

    // 유효성 검사 (amount는 음수여야 함)
    if (!userId || !amount || amount >= 0) {
      return res.status(400).json({ message: '사용자 ID와 음수 금액이 필요합니다.' });
    }

    // 로그 생성 및 사용자 크레딧 업데이트를 위해 createCreditLog 호출
    req.body.action = CreditAction.PROFILE_UNLOCK;
    await createCreditLog(req, res);
  } catch (error) {
    console.error('프로필 잠금해제 크레딧 사용 에러:', error);
    res.status(500).json({ message: '프로필 잠금해제 크레딧 사용 중 오류가 발생했습니다.' });
  }
}; 