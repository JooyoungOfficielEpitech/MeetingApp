import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';

// JWT 토큰에서 추출한 사용자 정보를 Request 객체에 추가하기 위한 인터페이스 확장
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

// 사용자 인증 확인 미들웨어
export const protect = async (req: Request, res: Response, next: NextFunction) => {
  let token;

  // Authorization 헤더에서 Bearer 토큰 추출
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];

      // 토큰 검증
      const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'user-secret-key');

      // 토큰에서 추출한 ID로 사용자 정보 조회 (비밀번호 해시 제외)
      req.user = await User.findById(decoded.id).select('-passwordHash');

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: '인증 실패: 사용자를 찾을 수 없습니다.'
        });
      }

      next();
    } catch (error) {
      console.error('인증 에러:', error);
      return res.status(401).json({
        success: false, 
        error: '인증되지 않았습니다.'
      });
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: '토큰이 없습니다. 인증되지 않았습니다.'
    });
  }
}; 