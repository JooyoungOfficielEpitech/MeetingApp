import express from 'express';
import { RequestHandler } from 'express-serve-static-core';
import * as matchQueueController from '../controllers/matchQueueController';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: MatchQueue
 *   description: 매칭 대기열 관리 API
 */

/**
 * @swagger
 * /api/queue/join:
 *   post:
 *     summary: 매칭 대기열에 참여
 *     tags: [MatchQueue]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - preferences
 *             properties:
 *               userId:
 *                 type: string
 *                 description: 사용자 ID
 *                 example: user-uuid
 *               preferences:
 *                 type: object
 *                 properties:
 *                   ageRange:
 *                     type: object
 *                     properties:
 *                       min:
 *                         type: number
 *                         example: 20
 *                       max:
 *                         type: number
 *                         example: 30
 *                   heightRange:
 *                     type: object
 *                     properties:
 *                       min:
 *                         type: number
 *                         example: 160
 *                       max:
 *                         type: number
 *                         example: 180
 *                   cities:
 *                     type: array
 *                     items:
 *                       type: string
 *                     example: ["Seoul", "Incheon"]
 *     responses:
 *       201:
 *         description: 매칭 대기열 참여 성공
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
 *                   example: 매칭 대기열에 참여했습니다.
 *       400:
 *         description: 잘못된 요청 (이미 대기열에 있음)
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.post('/join', matchQueueController.joinQueue as unknown as RequestHandler);

/**
 * @swagger
 * /api/queue/{userId}/leave:
 *   put:
 *     summary: 매칭 대기열에서 나가기
 *     tags: [MatchQueue]
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
 *         description: 매칭 대기열에서 나가기 성공
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
 *                   example: 매칭 대기열에서 나갔습니다.
 *       401:
 *         description: 인증 실패
 *       404:
 *         description: 대기열 항목을 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.put('/:userId/leave', matchQueueController.leaveQueue as unknown as RequestHandler);

/**
 * @swagger
 * /api/queue/{userId}/status:
 *   get:
 *     summary: 매칭 대기열 상태 확인
 *     tags: [MatchQueue]
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
 *         description: 매칭 대기열 상태
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 inQueue:
 *                   type: boolean
 *                   example: true
 *                 queueEntry:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     userId:
 *                       type: string
 *                     preferences:
 *                       type: object
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                   nullable: true
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.get('/:userId/status', matchQueueController.checkQueueStatus as unknown as RequestHandler);

/**
 * @swagger
 * /api/queue/{userId}/match:
 *   get:
 *     summary: 매칭 상대 찾기
 *     tags: [MatchQueue]
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
 *         description: 매칭 결과
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 matched:
 *                   type: boolean
 *                   example: true
 *                 matchedUser:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                     profile:
 *                       type: object
 *                   nullable: true
 *       401:
 *         description: 인증 실패
 *       404:
 *         description: 대기열에 없음
 *       500:
 *         description: 서버 오류
 */
router.get('/:userId/match', matchQueueController.findMatch as unknown as RequestHandler);

/**
 * @swagger
 * /api/queue:
 *   get:
 *     summary: 모든 대기열 항목 조회 (관리자용)
 *     tags: [MatchQueue]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 모든 대기열 항목
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 entries:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       userId:
 *                         type: string
 *                       preferences:
 *                         type: object
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *       401:
 *         description: 인증 실패
 *       403:
 *         description: 권한 없음 (관리자 아님)
 *       500:
 *         description: 서버 오류
 */
router.get('/', matchQueueController.getAllQueueEntries as unknown as RequestHandler);

export default router; 