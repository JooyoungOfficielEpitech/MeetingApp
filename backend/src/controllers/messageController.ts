import { Request, Response } from 'express';
import Message, { IMessage } from '../models/Message';
import ChatRoom from '../models/ChatRoom';
import User from '../models/User';

// 새 메시지 전송
export const sendMessage = async (req: Request, res: Response) => {
  try {
    const { chatRoomId, senderId, message } = req.body;

    // 유효성 검사
    if (!chatRoomId || !senderId || !message) {
      return res.status(400).json({ message: '채팅방 ID, 발신자 ID, 메시지 내용은 필수 항목입니다.' });
    }

    // 채팅방이 존재하는지 확인
    const chatRoom = await ChatRoom.findById(chatRoomId);
    if (!chatRoom) {
      return res.status(404).json({ message: '존재하지 않는 채팅방입니다.' });
    }

    // 채팅방이 활성 상태인지 확인
    if (!chatRoom.isActive) {
      return res.status(400).json({ message: '비활성화된 채팅방에는 메시지를 보낼 수 없습니다.' });
    }

    // 발신자가 채팅방 참여자인지 확인
    if (chatRoom.user1Id !== senderId && chatRoom.user2Id !== senderId) {
      return res.status(403).json({ message: '본인이 참여하지 않은 채팅방에는 메시지를 보낼 수 없습니다.' });
    }

    // 발신자가 존재하는 사용자인지 확인
    const sender = await User.findById(senderId);
    if (!sender) {
      return res.status(404).json({ message: '존재하지 않는, 발신자입니다.' });
    }

    // 새 메시지 생성
    const newMessage = new Message({
      chatRoomId,
      senderId,
      message
    });

    const savedMessage = await newMessage.save();

    res.status(201).json({
      message: '메시지가 전송되었습니다.',
      data: savedMessage
    });
  } catch (error) {
    console.error('메시지 전송 에러:', error);
    res.status(500).json({ message: '메시지 전송 중 오류가 발생했습니다.' });
  }
};

// 채팅방의 메시지 목록 조회
export const getChatRoomMessages = async (req: Request, res: Response) => {
  try {
    const { chatRoomId } = req.params;
    const { page = 1, limit = 50 } = req.query; // 페이징 처리

    // 페이지와 제한 숫자로 변환
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);

    // 채팅방이 존재하는지 확인
    const chatRoom = await ChatRoom.findById(chatRoomId);
    if (!chatRoom) {
      return res.status(404).json({ message: '존재하지 않는 채팅방입니다.' });
    }

    // 메시지 총 개수 (페이징 정보용)
    const totalMessages = await Message.countDocuments({ chatRoomId });

    // 메시지 조회 (최신 메시지가 먼저 나오도록 내림차순 정렬)
    const messages = await Message.find({ chatRoomId })
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    res.json({
      totalMessages,
      totalPages: Math.ceil(totalMessages / limitNum),
      currentPage: pageNum,
      messages: messages.reverse() // 클라이언트에 보낼 때는 시간순으로 정렬
    });
  } catch (error) {
    console.error('메시지 목록 조회 에러:', error);
    res.status(500).json({ message: '메시지 목록 조회 중 오류가 발생했습니다.' });
  }
};

// 특정 메시지 조회
export const getMessage = async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: '존재하지 않는 메시지입니다.' });
    }

    res.json(message);
  } catch (error) {
    console.error('메시지 조회 에러:', error);
    res.status(500).json({ message: '메시지 조회 중 오류가 발생했습니다.' });
  }
}; 