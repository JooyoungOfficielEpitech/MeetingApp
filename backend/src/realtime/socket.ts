import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../models/User';

interface UserSocket extends Socket {
  userId?: string;
  userInfo?: any;
}

export const initSocketServer = (httpServer: HttpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: '*', // 실제 배포 환경에서는 허용된 도메인만 설정
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // JWT 인증 미들웨어
  io.use(async (socket: UserSocket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error('인증 토큰이 필요합니다.'));
      }

      // JWT 토큰 검증
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret') as { id: string };
      
      if (!decoded || !decoded.id) {
        return next(new Error('유효하지 않은 토큰입니다.'));
      }

      // 사용자 정보 로드
      const user = await User.findById(decoded.id);
      
      if (!user) {
        return next(new Error('사용자를 찾을 수 없습니다.'));
      }

      // 소켓에 사용자 정보 저장
      socket.userId = user._id;
      socket.userInfo = {
        id: user._id,
        nickname: user.nickname,
        gender: user.gender
      };

      next();
    } catch (error) {
      return next(new Error('인증 오류가 발생했습니다.'));
    }
  });

  return io;
}; 