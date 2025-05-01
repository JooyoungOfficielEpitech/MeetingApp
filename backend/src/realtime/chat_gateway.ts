import { Server, Socket } from 'socket.io';
import Message from '../models/Message';
import ChatRoom from '../models/ChatRoom';
import User from '../models/User';

// 소켓에 사용자 정보를 추가하는 인터페이스
interface UserSocket extends Socket {
  userId?: string;
  userInfo?: any;
}

// 채팅방 관련 이벤트와 메시지 송수신을 처리하는 클래스
export class ChatGateway {
  constructor(private io: Server) {
    this.initialize();
  }

  // 초기화 및 이벤트 리스너 설정
  private initialize() {
    // 채팅 네임스페이스 설정
    const chatNamespace = this.io.of('/chat');

    chatNamespace.on('connection', async (socket: UserSocket) => {
      console.log(`User connected to chat: ${socket.userId}`);

      // 사용자의 채팅방 자동 참여
      this.joinUserRooms(socket);

      // 채팅방 참여 이벤트
      socket.on('join-room', (roomId: string) => {
        this.joinRoom(socket, roomId);
      });

      // 채팅방 나가기 이벤트
      socket.on('leave-room', (roomId: string) => {
        this.leaveRoom(socket, roomId);
      });

      // 메시지 전송 이벤트
      socket.on('send-message', async (data: { chatRoomId: string, message: string }) => {
        await this.handleSendMessage(socket, data);
      });

      // 타이핑 중 이벤트
      socket.on('typing', (data: { chatRoomId: string, isTyping: boolean }) => {
        this.handleTyping(socket, data);
      });
      
      // 읽음 상태 이벤트
      socket.on('read-messages', (data: { chatRoomId: string }) => {
        this.handleReadMessages(socket, data);
      });

      // 연결 해제 이벤트
      socket.on('disconnect', () => {
        console.log(`User disconnected from chat: ${socket.userId}`);
      });
    });
  }

  // 사용자가 참여 중인 모든 채팅방에 자동 참여
  private async joinUserRooms(socket: UserSocket) {
    try {
      if (!socket.userId) return;

      // 사용자가 참여 중인 모든 활성화된 채팅방 조회
      const chatRooms = await ChatRoom.find({
        $or: [{ user1Id: socket.userId }, { user2Id: socket.userId }],
        isActive: true
      });

      // 각 채팅방에 소켓 연결
      for (const room of chatRooms) {
        socket.join(room._id);
        console.log(`User ${socket.userId} joined room ${room._id}`);
      }

      // 참여 중인 채팅방 목록 전송
      socket.emit('joined-rooms', chatRooms.map(room => room._id));
    } catch (error) {
      console.error('Error joining user rooms:', error);
      socket.emit('error', { message: '채팅방 참여 중 오류가 발생했습니다.' });
    }
  }

  // 특정 채팅방 참여
  private async joinRoom(socket: UserSocket, roomId: string) {
    try {
      if (!socket.userId) return;

      // 채팅방 존재 및 참여 권한 확인
      const chatRoom = await ChatRoom.findOne({
        _id: roomId,
        $or: [{ user1Id: socket.userId }, { user2Id: socket.userId }],
        isActive: true
      });

      if (!chatRoom) {
        return socket.emit('error', { message: '채팅방을 찾을 수 없거나 참여 권한이 없습니다.' });
      }

      // 채팅방 참여
      socket.join(roomId);
      console.log(`User ${socket.userId} joined room ${roomId}`);
      
      // 채팅방 참여 알림
      socket.emit('room-joined', { roomId });
      
      // 최근 메시지 로드 (최근 20개)
      const recentMessages = await Message.find({ chatRoomId: roomId })
        .sort({ createdAt: -1 })
        .limit(20);
      
      socket.emit('recent-messages', { roomId, messages: recentMessages.reverse() });
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', { message: '채팅방 참여 중 오류가 발생했습니다.' });
    }
  }

  // 채팅방 나가기
  private leaveRoom(socket: UserSocket, roomId: string) {
    socket.leave(roomId);
    console.log(`User ${socket.userId} left room ${roomId}`);
    socket.emit('room-left', { roomId });
  }

  // 메시지 전송 처리
  private async handleSendMessage(socket: UserSocket, data: { chatRoomId: string, message: string }) {
    try {
      if (!socket.userId) return;
      
      const { chatRoomId, message } = data;
      
      if (!message.trim()) {
        return socket.emit('error', { message: '메시지 내용을 입력해주세요.' });
      }

      // 채팅방 존재 및 참여 권한 확인
      const chatRoom = await ChatRoom.findOne({
        _id: chatRoomId,
        $or: [{ user1Id: socket.userId }, { user2Id: socket.userId }],
        isActive: true
      });

      if (!chatRoom) {
        return socket.emit('error', { message: '채팅방을 찾을 수 없거나 참여 권한이 없습니다.' });
      }

      // 메시지 저장
      const newMessage = new Message({
        chatRoomId,
        senderId: socket.userId,
        message: message.trim()
      });
      
      await newMessage.save();
      
      // 채팅방의 모든 참여자에게 메시지 브로드캐스트
      this.io.of('/chat').to(chatRoomId).emit('new-message', {
        _id: newMessage._id,
        chatRoomId,
        senderId: socket.userId,
        senderNickname: socket.userInfo?.nickname,
        message: newMessage.message,
        createdAt: newMessage.createdAt
      });
      
      // 채팅방 마지막 업데이트 시간 갱신
      await ChatRoom.findByIdAndUpdate(chatRoomId, { updatedAt: new Date() });
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('error', { message: '메시지 전송 중 오류가 발생했습니다.' });
    }
  }

  // 타이핑 중 상태 처리
  private handleTyping(socket: UserSocket, data: { chatRoomId: string, isTyping: boolean }) {
    if (!socket.userId) return;
    
    const { chatRoomId, isTyping } = data;
    
    // 자신을 제외한 채팅방의 모든 사용자에게 타이핑 상태 전송
    socket.to(chatRoomId).emit('user-typing', {
      chatRoomId,
      userId: socket.userId,
      nickname: socket.userInfo?.nickname,
      isTyping
    });
  }

  // 메시지 읽음 상태 처리
  private handleReadMessages(socket: UserSocket, data: { chatRoomId: string }) {
    if (!socket.userId) return;
    
    const { chatRoomId } = data;
    
    // 채팅방의 다른 사용자에게 메시지 읽음 상태 알림
    socket.to(chatRoomId).emit('messages-read', {
      chatRoomId,
      userId: socket.userId,
      readAt: new Date()
    });
  }
} 