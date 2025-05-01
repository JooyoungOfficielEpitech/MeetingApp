import express from 'express';
import { RequestHandler } from 'express-serve-static-core';
import * as chatRoomController from '../controllers/chatRoomController';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: ChatRooms
 *   description: 채팅방 관리 API
 */

/**
 * @swagger
 * /api/chat-rooms:
 *   post:
 *     summary: 새 채팅방 생성
 *     tags: [ChatRooms]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user1Id
 *               - user2Id
 *             properties:
 *               user1Id:
 *                 type: string
 *                 description: 첫 번째 사용자 ID
 *                 example: user1-uuid
 *               user2Id:
 *                 type: string
 *                 description: 두 번째 사용자 ID
 *                 example: user2-uuid
 *     responses:
 *       201:
 *         description: 채팅방 생성 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 chatRoom:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: chatroom-uuid
 *                     user1Id:
 *                       type: string
 *                       example: user1-uuid
 *                     user2Id:
 *                       type: string
 *                       example: user2-uuid
 *                     isActive:
 *                       type: boolean
 *                       example: true
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: 잘못된 요청
 *       500:
 *         description: 서버 오류
 */
router.post('/', chatRoomController.createChatRoom as unknown as RequestHandler);

/**
 * @swagger
 * /api/chat-rooms/user/{userId}:
 *   get:
 *     summary: 특정 사용자의 모든 채팅방 조회
 *     tags: [ChatRooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: 사용자 ID
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
 *                       _id:
 *                         type: string
 *                       user1Id:
 *                         type: string
 *                       user2Id:
 *                         type: string
 *                       isActive:
 *                         type: boolean
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *       401:
 *         description: 인증 실패
 *       404:
 *         description: 사용자를 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.get('/user/:userId', chatRoomController.getUserChatRooms as unknown as RequestHandler);

/**
 * @swagger
 * /api/chat-rooms/{roomId}:
 *   get:
 *     summary: 특정 채팅방 정보 조회
 *     tags: [ChatRooms]
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
 *         description: 채팅방 정보
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 chatRoom:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     user1Id:
 *                       type: string
 *                     user2Id:
 *                       type: string
 *                     isActive:
 *                       type: boolean
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: 인증 실패
 *       404:
 *         description: 채팅방을 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.get('/:roomId', chatRoomController.getChatRoom as unknown as RequestHandler);

/**
 * @swagger
 * /api/chat-rooms/{roomId}/deactivate:
 *   put:
 *     summary: 채팅방 비활성화
 *     tags: [ChatRooms]
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
 *         description: 채팅방 비활성화 성공
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
 *                   example: 채팅방이 비활성화되었습니다.
 *       401:
 *         description: 인증 실패
 *       404:
 *         description: 채팅방을 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.put('/:roomId/deactivate', chatRoomController.deactivateChatRoom as unknown as RequestHandler);

export default router; 