import { JwtPayload } from 'jsonwebtoken';

declare global {
  namespace Express {
    interface Request {
      user?: { // authMiddleware에서 설정하는 타입과 일치시킵니다.
        userId: string;
        email: string;
      } & JwtPayload; // JwtPayload의 다른 속성(iat, exp 등)도 포함될 수 있음을 명시
    }
  }
}

// 이 파일이 모듈로 인식되도록 export {} 추가
export {}; 