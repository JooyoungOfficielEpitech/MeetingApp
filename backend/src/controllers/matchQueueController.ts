import { Request, Response } from 'express';
import MatchQueue, { IMatchQueue } from '../models/MatchQueue';
import User from '../models/User';

// 대기열 등록 (매칭 시작)
export const joinQueue = async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    // 사용자 존재 여부 확인
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    // 이미 대기 중인지 확인
    const existingQueue = await MatchQueue.findOne({ 
      userId, 
      isWaiting: true 
    });

    if (existingQueue) {
      return res.status(400).json({ 
        message: '이미 매칭 대기열에 등록되어 있습니다.',
        queueEntry: existingQueue
      });
    }

    // 새 대기열 항목 생성
    const queueEntry = new MatchQueue({
      userId,
      gender: user.gender,
      isWaiting: true
    });

    const savedEntry = await queueEntry.save();

    res.status(201).json({
      message: '매칭 대기열에 등록되었습니다.',
      queueEntry: savedEntry
    });
  } catch (error) {
    console.error('대기열 등록 에러:', error);
    res.status(500).json({ message: '대기열 등록 중 오류가 발생했습니다.' });
  }
};

// 대기열 취소 (매칭 취소)
export const leaveQueue = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const queueEntry = await MatchQueue.findOne({ 
      userId, 
      isWaiting: true 
    });

    if (!queueEntry) {
      return res.status(404).json({ message: '활성화된 대기열 항목을 찾을 수 없습니다.' });
    }

    queueEntry.isWaiting = false;
    await queueEntry.save();

    res.json({ 
      message: '매칭 대기가 취소되었습니다.',
      queueEntry
    });
  } catch (error) {
    console.error('대기열 취소 에러:', error);
    res.status(500).json({ message: '대기열 취소 중 오류가 발생했습니다.' });
  }
};

// 사용자의 대기 상태 확인
export const checkQueueStatus = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const queueEntry = await MatchQueue.findOne({ 
      userId, 
      isWaiting: true 
    });

    if (!queueEntry) {
      return res.status(404).json({ 
        isInQueue: false,
        message: '현재 매칭 대기열에 등록되어 있지 않습니다.' 
      });
    }

    res.json({ 
      isInQueue: true,
      message: '매칭 대기 중입니다.',
      queueEntry
    });
  } catch (error) {
    console.error('대기 상태 확인 에러:', error);
    res.status(500).json({ message: '대기 상태 확인 중 오류가 발생했습니다.' });
  }
};

// 모든 대기열 항목 조회 (관리자용)
export const getAllQueueEntries = async (_req: Request, res: Response) => {
  try {
    const queueEntries = await MatchQueue.find({ isWaiting: true })
      .sort({ createdAt: 1 })
      .populate('userId', 'nickname gender');

    res.json({
      count: queueEntries.length,
      queueEntries
    });
  } catch (error) {
    console.error('대기열 목록 조회 에러:', error);
    res.status(500).json({ message: '대기열 목록 조회 중 오류가 발생했습니다.' });
  }
};

// 매칭 알고리즘 - 대기 중인 이성 상대 찾기 (예시)
export const findMatch = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    // 사용자 정보 확인
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    // 현재 사용자의 성별과 반대 성별 구하기
    const oppositeGender = user.gender === 'male' ? 'female' : 'male';

    // 대기 중인 이성 상대 찾기 (생성 시간순)
    const potentialMatch = await MatchQueue.findOne({ 
      gender: oppositeGender,
      isWaiting: true,
      userId: { $ne: userId } // 자기 자신 제외
    }).sort({ createdAt: 1 });

    if (!potentialMatch) {
      return res.status(404).json({ 
        matched: false,
        message: '현재 매칭 가능한 상대가 없습니다.' 
      });
    }

    // 매칭 성공 처리 (양쪽 모두 isWaiting = false로 변경)
    const userQueue = await MatchQueue.findOne({ 
      userId, 
      isWaiting: true 
    });

    if (!userQueue) {
      return res.status(400).json({ 
        matched: false,
        message: '매칭 대기열에 등록되어 있지 않습니다.' 
      });
    }

    // 매칭 완료 처리
    userQueue.isWaiting = false;
    potentialMatch.isWaiting = false;

    await userQueue.save();
    await potentialMatch.save();

    // 매칭된 상대 정보 반환
    const matchedUser = await User.findById(potentialMatch.userId)
      .select('_id nickname gender birthYear height city profileImages');

    res.json({
      matched: true,
      message: '매칭에 성공했습니다!',
      matchedUser
    });
  } catch (error) {
    console.error('매칭 시도 에러:', error);
    res.status(500).json({ message: '매칭 처리 중 오류가 발생했습니다.' });
  }
}; 