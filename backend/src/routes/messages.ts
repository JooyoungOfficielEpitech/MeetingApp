import express, { Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
const db = require('../../models');
const Match = db.Match;
const Message = db.Message;
const User = db.User;
import { io } from '../socket';
import { connectedUsers } from '../socket/state';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Messages
 *   description: 메시지 관련 API
 */

/**
 * @swagger
 * /api/messages:
 *   post:
 *     summary: 메시지 전송
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - matchId
 *               - content
 *             properties:
 *               matchId:
 *                 type: string
 *               content:
 *                 type: string
 *     responses:
 *       201:
 *         description: 메시지 전송 성공
 *       400:
 *         description: 유효하지 않은 요청
 *       401:
 *         description: 인증 실패
 *       403:
 *         description: 매칭에 속하지 않은 사용자
 *       404:
 *         description: 매칭을 찾을 수 없음
 */
// @ts-ignore
router.post('/', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { matchId, content } = req.body;
    const userId = req.user?.userId;

    if (!matchId || !content) {
      return res.status(400).json({ error: '매칭 ID와 메시지 내용이 필요합니다.' });
    }

    if (content.trim() === '') {
      return res.status(400).json({ error: '메시지 내용을 입력해주세요.' });
    }

    // 매칭 확인
    const match = await Match.findOne({
      where: { 
        matchId: matchId, 
        isActive: true 
      }
    });

    if (!match) {
      return res.status(404).json({ error: '매칭을 찾을 수 없습니다.' });
    }

    // 매칭에 속한 사용자인지 확인
    if (match.user1Id !== userId && match.user2Id !== userId) {
      return res.status(403).json({ error: '해당 매칭에 속하지 않은 사용자입니다.' });
    }

    // 메시지 생성
    const message = await Message.create({
      matchId: matchId,
      senderId: userId,
      text: content,
      timestamp: new Date()
    });

    // 상대방 ID 구하기
    const recipientId = match.user1Id === userId ? match.user2Id : match.user1Id;

    // 소켓으로 실시간 메시지 전송
    try {
      let recipientSocketId = null;
      for (const [socketId, connectedUser] of connectedUsers.entries()) {
        if (connectedUser.userId === recipientId) {
          recipientSocketId = socketId;
          break;
        }
      }

      if (recipientSocketId) {
        io.to(recipientSocketId).emit('new_message', {
          matchId: matchId,
          message: {
            id: message.id,
            content: message.text,
            senderId: message.senderId,
            timestamp: message.timestamp,
            read: false
          }
        });
      }
    } catch (socketError) {
      console.error('[Message Send] Socket notification error:', socketError);
      // 소켓 에러는 API 응답에 영향을 주지 않음
    }

    return res.status(201).json({ 
      success: true, 
      message: {
        id: message.id,
        content: message.text,
        senderId: message.senderId,
        timestamp: message.timestamp
      }
    });
  } catch (error) {
    console.error('[POST /api/messages] Error:', error);
    next(error);
  }
});

/**
 * @swagger
 * /api/messages/{matchId}:
 *   get:
 *     summary: 매칭의 메시지 목록 조회
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: matchId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 메시지 목록 조회 성공
 *       401:
 *         description: 인증 실패
 *       403:
 *         description: 매칭에 속하지 않은 사용자
 *       404:
 *         description: 매칭을 찾을 수 없음
 */
// @ts-ignore
router.get('/:matchId', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { matchId } = req.params;
    const userId = req.user?.userId;

    // 매칭 확인
    const match = await Match.findOne({
      where: { 
        matchId: matchId
      }
    });

    if (!match) {
      return res.status(404).json({ error: '매칭을 찾을 수 없습니다.' });
    }

    // 매칭에 속한 사용자인지 확인
    if (match.user1Id !== userId && match.user2Id !== userId) {
      return res.status(403).json({ error: '해당 매칭에 속하지 않은 사용자입니다.' });
    }

    // 메시지 목록 조회
    const messages = await Message.findAll({
      where: { matchId: matchId },
      order: [['timestamp', 'ASC']]
    });

    // 응답 데이터 형식 변환
    const formattedMessages = messages.map((msg: any) => ({
      id: msg.id,
      content: msg.text,
      senderId: msg.senderId,
      timestamp: msg.timestamp,
      read: msg.read || false
    }));

    return res.status(200).json({ messages: formattedMessages });
  } catch (error) {
    console.error(`[GET /api/messages/${req.params.matchId}] Error:`, error);
    next(error);
  }
});

/**
 * @swagger
 * /api/messages/{matchId}/read:
 *   put:
 *     summary: 매칭의 메시지를 읽음으로 표시
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: matchId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 메시지 읽음 표시 성공
 *       401:
 *         description: 인증 실패
 *       403:
 *         description: 매칭에 속하지 않은 사용자
 *       404:
 *         description: 매칭을 찾을 수 없음
 */
// @ts-ignore
router.put('/:matchId/read', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { matchId } = req.params;
    const userId = req.user?.userId;

    // 매칭 확인
    const match = await Match.findOne({
      where: { 
        matchId: matchId
      }
    });

    if (!match) {
      return res.status(404).json({ error: '매칭을 찾을 수 없습니다.' });
    }

    // 매칭에 속한 사용자인지 확인
    if (match.user1Id !== userId && match.user2Id !== userId) {
      return res.status(403).json({ error: '해당 매칭에 속하지 않은 사용자입니다.' });
    }

    // 상대방 ID 구하기
    const senderId = match.user1Id === userId ? match.user2Id : match.user1Id;

    // 상대방이 보낸 메시지를 모두 읽음으로 표시
    await Message.update(
      { read: true },
      { where: { matchId: matchId, senderId: senderId, read: false } }
    );

    // 상대방에게 소켓으로 읽음 상태 알림
    try {
      let senderSocketId = null;
      for (const [socketId, connectedUser] of connectedUsers.entries()) {
        if (connectedUser.userId === senderId) {
          senderSocketId = socketId;
          break;
        }
      }

      if (senderSocketId) {
        io.to(senderSocketId).emit('messages_read', {
          matchId: matchId,
          readerId: userId
        });
      }
    } catch (socketError) {
      console.error('[Message Read] Socket notification error:', socketError);
      // 소켓 에러는 API 응답에 영향을 주지 않음
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error(`[PUT /api/messages/${req.params.matchId}/read] Error:`, error);
    next(error);
  }
});

export default router; 