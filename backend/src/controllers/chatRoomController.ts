import { Request, Response } from 'express';
import ChatRoom, { IChatRoom } from '../models/ChatRoom';
import User from '../models/User';

// 새 채팅방 생성
export const createChatRoom = async (req: Request, res: Response) => {
  try {
    const { user1Id, user2Id } = req.body;

    // 두 사용자가 존재하는지 확인
    const user1 = await User.findById(user1Id);
    const user2 = await User.findById(user2Id);

    if (!user1 || !user2) {
      return res.status(404).json({ message: '한 명 이상의 사용자를 찾을 수 없습니다.' });
    }

    // 두 사용자가 같은 사용자인지 확인
    if (user1Id === user2Id) {
      return res.status(400).json({ message: '자기 자신과 채팅방을 생성할 수 없습니다.' });
    }

    // 이미 활성화된 채팅방이 있는지 확인 (양방향으로 확인)
    const existingChatRoom = await ChatRoom.findOne({
      $or: [
        { user1Id, user2Id, isActive: true },
        { user1Id: user2Id, user2Id: user1Id, isActive: true }
      ]
    });

    if (existingChatRoom) {
      return res.status(200).json({
        message: '이미 활성화된 채팅방이 존재합니다.',
        chatRoom: existingChatRoom
      });
    }

    // 새 채팅방 생성
    const newChatRoom = new ChatRoom({
      user1Id,
      user2Id,
      isActive: true
    });

    const savedChatRoom = await newChatRoom.save();

    res.status(201).json({
      message: '채팅방이 생성되었습니다.',
      chatRoom: savedChatRoom
    });
  } catch (error) {
    console.error('채팅방 생성 에러:', error);
    res.status(500).json({ message: '채팅방 생성 중 오류가 발생했습니다.' });
  }
};

// 사용자의 모든 채팅방 조회
export const getUserChatRooms = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    // 사용자가 존재하는지 확인
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    // 사용자가 참여한 모든 활성 채팅방 조회
    const chatRooms = await ChatRoom.find({
      $or: [
        { user1Id: userId, isActive: true },
        { user2Id: userId, isActive: true }
      ]
    }).sort({ updatedAt: -1 }); // 최신순으로 정렬

    // 채팅방 상대방 정보 포함 (채팅방마다 상대방이 다름)
    const chatRoomsWithPartnerInfo = await Promise.all(
      chatRooms.map(async (room) => {
        const partnerId = room.user1Id === userId ? room.user2Id : room.user1Id;
        const partner = await User.findById(partnerId).select('_id nickname profileImages');
        
        return {
          _id: room._id,
          isActive: room.isActive,
          createdAt: room.createdAt,
          updatedAt: room.updatedAt,
          partner
        };
      })
    );

    res.json({
      count: chatRoomsWithPartnerInfo.length,
      chatRooms: chatRoomsWithPartnerInfo
    });
  } catch (error) {
    console.error('채팅방 목록 조회 에러:', error);
    res.status(500).json({ message: '채팅방 목록 조회 중 오류가 발생했습니다.' });
  }
};

// 특정 채팅방 조회
export const getChatRoom = async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;

    const chatRoom = await ChatRoom.findById(roomId);
    if (!chatRoom) {
      return res.status(404).json({ message: '채팅방을 찾을 수 없습니다.' });
    }

    // 채팅방에 참여 중인 사용자 정보 포함
    const user1 = await User.findById(chatRoom.user1Id).select('_id nickname profileImages');
    const user2 = await User.findById(chatRoom.user2Id).select('_id nickname profileImages');

    res.json({
      _id: chatRoom._id,
      isActive: chatRoom.isActive,
      createdAt: chatRoom.createdAt,
      updatedAt: chatRoom.updatedAt,
      participants: {
        user1,
        user2
      }
    });
  } catch (error) {
    console.error('채팅방 조회 에러:', error);
    res.status(500).json({ message: '채팅방 조회 중 오류가 발생했습니다.' });
  }
};

// 채팅방 비활성화 (삭제)
export const deactivateChatRoom = async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;

    const chatRoom = await ChatRoom.findById(roomId);
    if (!chatRoom) {
      return res.status(404).json({ message: '채팅방을 찾을 수 없습니다.' });
    }

    if (!chatRoom.isActive) {
      return res.status(400).json({ message: '이미 비활성화된 채팅방입니다.' });
    }

    chatRoom.isActive = false;
    await chatRoom.save();

    res.json({
      message: '채팅방이 비활성화되었습니다.',
      chatRoom
    });
  } catch (error) {
    console.error('채팅방 비활성화 에러:', error);
    res.status(500).json({ message: '채팅방 비활성화 중 오류가 발생했습니다.' });
  }
}; 