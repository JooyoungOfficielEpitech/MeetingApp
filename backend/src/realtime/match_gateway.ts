import { Server, Socket } from 'socket.io';
import MatchQueue, { IMatchQueue } from '../models/MatchQueue';
import User from '../models/User';
import CreditLog, { CreditAction } from '../models/CreditLog';
import ChatRoom from '../models/ChatRoom';

// 소켓에 사용자 정보를 추가하는 인터페이스
interface UserSocket extends Socket {
  userId?: string;
  userInfo?: any;
}

// 매칭 관련 이벤트를 처리하는 클래스
export class MatchGateway {
  private readonly MATCHING_CREDIT_COST = 10; // 매칭에 필요한 크레딧
  private matchingUsers: Map<string, UserSocket> = new Map(); // 매칭 대기중인 사용자들

  constructor(private io: Server) {
    this.initialize();
  }

  // 초기화 및 이벤트 리스너 설정
  private initialize() {
    // 매칭 네임스페이스 설정
    const matchNamespace = this.io.of('/match');

    matchNamespace.on('connection', (socket: UserSocket) => {
      console.log(`User connected to match: ${socket.userId}`);

      // 매칭 요청 이벤트
      socket.on('request-match', async () => {
        await this.handleMatchRequest(socket);
      });

      // 매칭 취소 이벤트
      socket.on('cancel-match', async () => {
        await this.handleCancelMatch(socket);
      });

      // 매칭 상태 확인 이벤트
      socket.on('check-match-status', async () => {
        await this.handleCheckMatchStatus(socket);
      });

      // 연결 해제 이벤트
      socket.on('disconnect', async () => {
        console.log(`User disconnected from match: ${socket.userId}`);
        await this.handleCancelMatch(socket);
      });
    });

    // 주기적인 매칭 처리 (10초마다)
    setInterval(() => {
      this.processMatching();
    }, 10000);
  }

  // 매칭 요청 처리
  private async handleMatchRequest(socket: UserSocket) {
    try {
      if (!socket.userId) {
        return socket.emit('match-error', { message: '인증된 사용자만 매칭을 요청할 수 있습니다.' });
      }

      // 사용자 정보 확인
      const user = await User.findById(socket.userId);
      
      if (!user) {
        return socket.emit('match-error', { message: '사용자 정보를 찾을 수 없습니다.' });
      }

      // 이미 대기열에 있는지 확인
      const existingQueue = await MatchQueue.findOne({
        userId: socket.userId,
        isWaiting: true
      });

      if (existingQueue) {
        return socket.emit('match-error', { message: '이미 매칭 대기열에 등록되어 있습니다.' });
      }

      // 크레딧 확인
      if (user.credit < this.MATCHING_CREDIT_COST) {
        return socket.emit('match-error', { message: '크레딧이 부족합니다.' });
      }

      // 크레딧 차감
      user.credit -= this.MATCHING_CREDIT_COST;
      await user.save();

      // 크레딧 로그 생성
      await CreditLog.create({
        userId: socket.userId,
        action: CreditAction.MATCH,
        amount: -this.MATCHING_CREDIT_COST
      });

      // 매칭 대기열에 등록
      const matchQueue = new MatchQueue({
        userId: socket.userId,
        gender: user.gender,
        isWaiting: true
      });

      await matchQueue.save();

      // 매칭 대기 중인 사용자 목록에 추가
      this.matchingUsers.set(socket.userId, socket);

      // 매칭 요청 성공 응답
      socket.emit('match-requested', {
        success: true,
        message: '매칭 대기열에 등록되었습니다.',
        queueId: matchQueue._id
      });

      // 즉시 매칭 시도
      this.tryMatchForUser(socket.userId, user.gender);
    } catch (error) {
      console.error('Match request error:', error);
      socket.emit('match-error', { message: '매칭 요청 중 오류가 발생했습니다.' });
    }
  }

  // 매칭 취소 처리
  private async handleCancelMatch(socket: UserSocket) {
    try {
      if (!socket.userId) return;

      // 대기 중인 매칭 요청 확인
      const queueEntry = await MatchQueue.findOne({
        userId: socket.userId,
        isWaiting: true
      });

      if (!queueEntry) {
        return socket.emit('match-canceled', {
          success: false,
          message: '대기 중인 매칭 요청이 없습니다.'
        });
      }

      // 매칭 대기 상태 변경
      queueEntry.isWaiting = false;
      await queueEntry.save();

      // 매칭 대기 중인 사용자 목록에서 제거
      this.matchingUsers.delete(socket.userId);

      socket.emit('match-canceled', {
        success: true,
        message: '매칭 요청이 취소되었습니다.'
      });
    } catch (error) {
      console.error('Cancel match error:', error);
      socket.emit('match-error', { message: '매칭 취소 중 오류가 발생했습니다.' });
    }
  }

  // 매칭 상태 확인 처리
  private async handleCheckMatchStatus(socket: UserSocket) {
    try {
      if (!socket.userId) return;

      // 현재 대기 중인 매칭 요청 확인
      const queueEntry = await MatchQueue.findOne({
        userId: socket.userId,
        isWaiting: true
      });

      // 대기 중인 매칭이 있는 경우
      if (queueEntry) {
        return socket.emit('match-status', {
          isWaiting: true,
          matchedUser: null,
          queuedAt: queueEntry.createdAt
        });
      }

      // 최근 매칭된 결과 확인 (최근 1시간 이내)
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);

      // 타입 단언을 사용하여 업데이트 시간 속성에 접근합니다
      const recentMatch = await MatchQueue.findOne({
        userId: socket.userId,
        isWaiting: false,
        updatedAt: { $gte: oneHourAgo }
      }).sort({ updatedAt: -1 });

      if (!recentMatch) {
        return socket.emit('match-status', {
          isWaiting: false,
          matchedUser: null
        });
      }

      // 최근 생성된 채팅방 찾기
      const recentChatRoom = await ChatRoom.findOne({
        $or: [
          { user1Id: socket.userId },
          { user2Id: socket.userId }
        ],
        createdAt: { $gte: recentMatch.updatedAt as Date }
      }).sort({ createdAt: -1 });

      if (!recentChatRoom) {
        return socket.emit('match-status', {
          isWaiting: false,
          matchedUser: null
        });
      }

      // 매칭된 상대방 ID 찾기
      const matchedUserId = recentChatRoom.user1Id === socket.userId
        ? recentChatRoom.user2Id
        : recentChatRoom.user1Id;

      // 매칭된 상대방 정보
      const matchedUser = await User.findById(matchedUserId).select('_id nickname birthYear height city profileImages gender');

      if (!matchedUser) {
        return socket.emit('match-status', {
          isWaiting: false,
          matchedUser: null
        });
      }

      // 상대방 정보 반환 (프로필 이미지는 블러 처리)
      const blurredProfileImages = matchedUser.profileImages.map(img => `blurred-${img}`);

      socket.emit('match-status', {
        isWaiting: false,
        matchedUser: {
          id: matchedUser._id,
          nickname: matchedUser.nickname,
          birthYear: matchedUser.birthYear,
          height: matchedUser.height,
          city: matchedUser.city,
          gender: matchedUser.gender,
          profileImages: blurredProfileImages,
          chatRoomId: recentChatRoom._id
        }
      });
    } catch (error) {
      console.error('Check match status error:', error);
      socket.emit('match-error', { message: '매칭 상태 확인 중 오류가 발생했습니다.' });
    }
  }

  // 매칭 처리 루프
  private async processMatching() {
    // 대기열에 있는 모든 사용자 조회
    const waitingUsers = await MatchQueue.find({ isWaiting: true })
      .sort({ createdAt: 1 }); // 오래 기다린 사용자 우선

    // 성별별 대기 목록
    const maleWaiting = waitingUsers.filter(user => user.gender === 'male');
    const femaleWaiting = waitingUsers.filter(user => user.gender === 'female');

    // 매칭 가능한 쌍만큼 반복
    const pairsToMatch = Math.min(maleWaiting.length, femaleWaiting.length);
    
    for (let i = 0; i < pairsToMatch; i++) {
      const maleUser = maleWaiting[i];
      const femaleUser = femaleWaiting[i];
      
      // 두 사용자 매칭
      await this.matchUsers(maleUser.userId, femaleUser.userId);
    }
  }

  // 특정 사용자의 성별에 맞는 매칭 찾기
  private async tryMatchForUser(userId: string, gender: string) {
    try {
      // 반대 성별의 가장 오래된 대기자 찾기
      const oppositeGender = gender === 'male' ? 'female' : 'male';
      
      const oldestWaiting = await MatchQueue.findOne({
        gender: oppositeGender,
        isWaiting: true,
        userId: { $ne: userId } // 자기 자신 제외
      }).sort({ createdAt: 1 });
      
      if (oldestWaiting) {
        // 매칭 처리
        await this.matchUsers(
          gender === 'male' ? userId : oldestWaiting.userId,
          gender === 'female' ? userId : oldestWaiting.userId
        );
      }
    } catch (error) {
      console.error('Try match for user error:', error);
    }
  }

  // 두 사용자 매칭 처리
  private async matchUsers(maleUserId: string, femaleUserId: string) {
    try {
      // 두 사용자의 대기 상태 변경
      await MatchQueue.updateMany(
        { userId: { $in: [maleUserId, femaleUserId] }, isWaiting: true },
        { isWaiting: false }
      );
      
      // 채팅방 생성
      const chatRoom = new ChatRoom({
        user1Id: maleUserId,
        user2Id: femaleUserId,
        isActive: true
      });
      
      await chatRoom.save();
      
      // 두 사용자에게 매칭 알림
      const maleSocket = this.matchingUsers.get(maleUserId);
      const femaleSocket = this.matchingUsers.get(femaleUserId);
      
      // 매칭 대기자 목록에서 제거
      this.matchingUsers.delete(maleUserId);
      this.matchingUsers.delete(femaleUserId);
      
      // 남성 사용자 정보
      const maleUser = await User.findById(maleUserId)
        .select('_id nickname birthYear height city profileImages');
      
      // 여성 사용자 정보
      const femaleUser = await User.findById(femaleUserId)
        .select('_id nickname birthYear height city profileImages');
      
      if (maleUser && femaleUser) {
        // 남성 사용자에게 알림
        if (maleSocket) {
          const blurredFemaleImages = femaleUser.profileImages.map(img => `blurred-${img}`);
          maleSocket.emit('match-found', {
            matchedUser: {
              id: femaleUser._id,
              nickname: femaleUser.nickname,
              birthYear: femaleUser.birthYear,
              height: femaleUser.height,
              city: femaleUser.city,
              profileImages: blurredFemaleImages,
              gender: 'female'
            },
            chatRoomId: chatRoom._id
          });
        }
        
        // 여성 사용자에게 알림
        if (femaleSocket) {
          const blurredMaleImages = maleUser.profileImages.map(img => `blurred-${img}`);
          femaleSocket.emit('match-found', {
            matchedUser: {
              id: maleUser._id,
              nickname: maleUser.nickname,
              birthYear: maleUser.birthYear,
              height: maleUser.height,
              city: maleUser.city,
              profileImages: blurredMaleImages,
              gender: 'male'
            },
            chatRoomId: chatRoom._id
          });
        }
      }
      
      console.log(`Matched users: ${maleUserId} and ${femaleUserId}, created chat room: ${chatRoom._id}`);
    } catch (error) {
      console.error('Match users error:', error);
    }
  }
} 