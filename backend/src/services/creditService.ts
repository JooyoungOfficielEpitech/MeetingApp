import CreditLog, { ICreditLog, CreditAction } from '../models/CreditLog';
import User from '../models/User';
import mongoose from 'mongoose';

export class CreditService {
  // 크레딧 충전
  async chargeCredit(userId: string, amount: number, description: string): Promise<ICreditLog> {
    try {
      // 사용자의 크레딧 업데이트
      const user = await User.findByIdAndUpdate(
        userId,
        { $inc: { credit: amount } },
        { new: true }
      );
      
      if (!user) {
        throw new Error('사용자를 찾을 수 없습니다');
      }
      
      // 크레딧 로그 생성
      const creditLog = await CreditLog.create({
        userId: userId,
        amount,
        action: CreditAction.CHARGE
      });
      
      return creditLog;
    } catch (error) {
      throw error;
    }
  }
  
  // 크레딧 사용
  async useCredit(userId: string, amount: number, service: string, description: string): Promise<ICreditLog> {
    try {
      // 사용자 조회
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('사용자를 찾을 수 없습니다');
      }
      
      // 크레딧이 충분한지 확인
      if (user.credit < amount) {
        throw new Error('크레딧이 부족합니다');
      }
      
      // 사용자의 크레딧 차감
      await User.findByIdAndUpdate(
        userId,
        { $inc: { credit: -amount } }
      );
      
      // 크레딧 로그 생성 (서비스에 따라 액션 결정)
      let action = CreditAction.MATCH; // 기본값
      
      if (service === 'profileUnlock') {
        action = CreditAction.PROFILE_UNLOCK;
      }
      
      const creditLog = await CreditLog.create({
        userId: userId,
        amount: -amount,
        action: action
      });
      
      return creditLog;
    } catch (error) {
      throw error;
    }
  }
  
  // 사용자의 크레딧 로그 조회
  async getCreditLogs(userId: string): Promise<ICreditLog[]> {
    return CreditLog.find({ userId }).sort({ createdAt: -1 });
  }
  
  // 사용자의 현재 크레딧 조회
  async getCurrentCredit(userId: string): Promise<number> {
    const user = await User.findById(userId).select('credit');
    if (!user) {
      throw new Error('사용자를 찾을 수 없습니다');
    }
    return user.credit;
  }
} 