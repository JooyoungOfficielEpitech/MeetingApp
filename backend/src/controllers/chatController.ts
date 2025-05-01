import { Request, Response } from 'express';
import ChatRoom from '../models/ChatRoom';
import Message from '../models/Message';
import User from '../models/User';

// 내 채팅방 목록 조회
export const getMyChatRooms = async (req: Request, res: Response) => {
  try {
    const user = req.user;

    // 활성화된 채팅방 중 사용자가 참여하고 있는 채팅방만 조회
    const chatRooms = await ChatRoom.find({
      $or: [
        { user1Id: user._id, isActive: true },
        { user2Id: user._id, isActive: true }
      ]
    }).sort({ updatedAt: -1 }); // 최신 업데이트 순으로 정렬

    // 채팅방 정보와 상대방 정보를 포함한 응답 데이터 생성
    const formattedRooms = await Promise.all(
      chatRooms.map(async room => {
        // 상대방 ID 결정
        const partnerId = room.user1Id === user._id ? room.user2Id : room.user1Id;
        
        // 상대방 정보 조회
        const partner = await User.findById(partnerId).select('_id nickname profileImages');
        
        if (!partner) {
          return null; // 상대방을 찾을 수 없는 경우 (드문 경우)
        }

        return {
          roomId: room._id,
          user: {
            id: partner._id,
            nickname: partner.nickname,
            profileImage: partner.profileImages && partner.profileImages.length > 0 
              ? partner.profileImages[0] 
              : null
          }
        };
      })
    );

    // null 값을 필터링
    const validRooms = formattedRooms.filter(room => room !== null);

    res.json({
      success: true,
      chatRooms: validRooms
    });
  } catch (error) {
    console.error('채팅방 목록 조회 에러:', error);
    res.status(500).json({
      success: false,
      error: '채팅방 목록 조회 중 오류가 발생했습니다.'
    });
  }
};

// 특정 채팅방의 메시지 조회
export const getChatRoomMessages = async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const user = req.user;

    // 채팅방 존재 여부 및 접근 권한 확인
    const chatRoom = await ChatRoom.findOne({
      _id: roomId,
      isActive: true,
      $or: [
        { user1Id: user._id },
        { user2Id: user._id }
      ]
    });

    if (!chatRoom) {
      return res.status(404).json({
        success: false,
        error: '채팅방을 찾을 수 없거나 접근 권한이 없습니다.'
      });
    }

    // 채팅방 메시지 조회 (최신 50개)
    const messages = await Message.find({ chatRoomId: roomId })
      .sort({ createdAt: 1 }) // 시간순 정렬
      .limit(50);

    // 응답 데이터 형식에 맞게 변환
    const formattedMessages = messages.map(msg => ({
      senderId: msg.senderId,
      message: msg.message,
      createdAt: msg.createdAt
    }));

    res.json({
      success: true,
      messages: formattedMessages
    });
  } catch (error) {
    console.error('채팅 메시지 조회 에러:', error);
    res.status(500).json({
      success: false,
      error: '채팅 메시지 조회 중 오류가 발생했습니다.'
    });
  }
};

// 메시지 전송
export const sendMessage = async (req: Request, res: Response) => {
  try {
    const { roomId, message } = req.body;
    const user = req.user;

    // 필수 파라미터 확인
    if (!roomId || !message) {
      return res.status(400).json({
        success: false,
        error: '채팅방 ID와 메시지 내용은 필수 항목입니다.'
      });
    }

    // 채팅방 존재 여부 및 접근 권한 확인
    const chatRoom = await ChatRoom.findOne({
      _id: roomId,
      isActive: true,
      $or: [
        { user1Id: user._id },
        { user2Id: user._id }
      ]
    });

    if (!chatRoom) {
      return res.status(404).json({
        success: false,
        error: '채팅방을 찾을 수 없거나 접근 권한이 없습니다.'
      });
    }

    // 새 메시지 생성
    const newMessage = new Message({
      chatRoomId: roomId,
      senderId: user._id,
      message
    });

    await newMessage.save();

    // 채팅방 업데이트 시간 갱신
    chatRoom.updatedAt = new Date();
    await chatRoom.save();

    res.json({
      success: true,
      message: '메시지 전송 완료'
    });
  } catch (error) {
    console.error('메시지 전송 에러:', error);
    res.status(500).json({
      success: false,
      error: '메시지 전송 중 오류가 발생했습니다.'
    });
  }
}; 