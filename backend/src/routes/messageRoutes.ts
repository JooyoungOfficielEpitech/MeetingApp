import express from 'express';
import { RequestHandler } from 'express-serve-static-core';
import * as messageController from '../controllers/messageController';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Messages
 *   description: 메시지 관리 API
 */

/**
 * @swagger
 * /api/messages:
 *   post:
 *     summary: 새 메시지 전송
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
 *               - chatRoomId
 *               - senderId
 *               - content
 *             properties:
 *               chatRoomId:
 *                 type: string
 *                 description: 채팅방 ID
 *                 example: chatroom-uuid
 *               senderId:
 *                 type: string
 *                 description: 발신자 ID
 *                 example: user-uuid
 *               content:
 *                 type: string
 *                 description: 메시지 내용
 *                 example: 안녕하세요! 만나서 반갑습니다.
 *     responses:
 *       201:
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
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     chatRoomId:
 *                       type: string
 *                     senderId:
 *                       type: string
 *                     content:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: 잘못된 요청
 *       401:
 *         description: 인증 실패
 *       404:
 *         description: 채팅방을 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.post('/', messageController.sendMessage as unknown as RequestHandler);

/**
 * @swagger
 * /api/messages/chat-room/{chatRoomId}:
 *   get:
 *     summary: 특정 채팅방의 메시지 목록 조회
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatRoomId
 *         required: true
 *         schema:
 *           type: string
 *         description: 채팅방 ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 페이지 번호
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: 페이지당 메시지 수
 *     responses:
 *       200:
 *         description: 메시지 목록
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 totalMessages:
 *                   type: integer
 *                   example: 120
 *                 totalPages:
 *                   type: integer
 *                   example: 3
 *                 currentPage:
 *                   type: integer
 *                   example: 1
 *                 messages:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       chatRoomId:
 *                         type: string
 *                       senderId:
 *                         type: string
 *                       content:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *       401:
 *         description: 인증 실패
 *       404:
 *         description: 채팅방을 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.get('/chat-room/:chatRoomId', messageController.getChatRoomMessages as unknown as RequestHandler);

/**
 * @swagger
 * /api/messages/{messageId}:
 *   get:
 *     summary: 특정 메시지 조회
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *         description: 메시지 ID
 *     responses:
 *       200:
 *         description: 메시지 정보
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     chatRoomId:
 *                       type: string
 *                     senderId:
 *                       type: string
 *                     content:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: 인증 실패
 *       404:
 *         description: 메시지를 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.get('/:messageId', messageController.getMessage as unknown as RequestHandler);

export default router; 