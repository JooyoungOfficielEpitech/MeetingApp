import express from 'express';
import { RequestHandler } from 'express-serve-static-core';
import { getMyChatRooms, getChatRoomMessages, sendMessage } from '../controllers/chatController';
import { protect } from '../middleware/userAuthMiddleware';

const router = express.Router();

// 모든 라우트에 인증 미들웨어 적용
router.use(protect as RequestHandler);

/**
 * @swagger
 * tags:
 *   name: Chat
 *   description: 채팅 관리 API
 */

/**
 * @swagger
 * /api/chat/rooms:
 *   get:
 *     summary: 내 채팅방 리스트 조회
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 채팅방 목록
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 chatRooms:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       roomId:
 *                         type: string
 *                         example: uuid
 *                       user:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: 상대 uuid
 *                           nickname:
 *                             type: string
 *                             example: 닉네임
 *                           profileImage:
 *                             type: string
 *                             example: profile-url
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.get('/rooms', getMyChatRooms as unknown as RequestHandler);

/**
 * @swagger
 * /api/chat/room/{roomId}:
 *   get:
 *     summary: 특정 채팅방 메시지 불러오기
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *         description: 채팅방 ID
 *     responses:
 *       200:
 *         description: 채팅방 메시지 목록
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 messages:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       senderId:
 *                         type: string
 *                         example: uuid
 *                       message:
 *                         type: string
 *                         example: 안녕하세요
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         example: 2025-04-29T12:34:56Z
 *       401:
 *         description: 인증 실패
 *       404:
 *         description: 채팅방을 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.get('/room/:roomId', getChatRoomMessages as unknown as RequestHandler);

/**
 * @swagger
 * /api/chat/message:
 *   post:
 *     summary: 채팅 메시지 보내기
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - roomId
 *               - message
 *             properties:
 *               roomId:
 *                 type: string
 *                 description: 채팅방 ID
 *                 example: 채팅방 ID
 *               message:
 *                 type: string
 *                 description: 메시지 내용
 *                 example: 메시지 내용
 *     responses:
 *       200:
 *         description: 메시지 전송 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 메시지 전송 완료
 *       400:
 *         description: 잘못된 요청
 *       401:
 *         description: 인증 실패
 *       404:
 *         description: 채팅방을 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.post('/message', sendMessage as unknown as RequestHandler);

export default router; 