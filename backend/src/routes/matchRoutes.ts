import express from 'express';
import { RequestHandler } from 'express-serve-static-core';
import { requestMatch, checkMatchStatus, cancelMatch } from '../controllers/matchController';
import { protect } from '../middleware/userAuthMiddleware';

const router = express.Router();

// 모든 라우트에 인증 미들웨어 적용
router.use(protect as RequestHandler);

/**
 * @swagger
 * tags:
 *   name: Match
 *   description: 매칭 관리 API
 */

/**
 * @swagger
 * /api/match/request:
 *   post:
 *     summary: 매칭 요청 (크레딧 10개 차감)
 *     tags: [Match]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 매칭 요청 성공
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
 *                   example: 매칭 대기열에 등록되었습니다.
 *       400:
 *         description: 잘못된 요청 (크레딧 부족 등)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: 크레딧이 부족합니다.
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.post('/request', requestMatch as unknown as RequestHandler);

/**
 * @swagger
 * /api/match/status:
 *   get:
 *     summary: 현재 매칭 상태 조회
 *     tags: [Match]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 현재 매칭 상태
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                       example: true
 *                     isWaiting:
 *                       type: boolean
 *                       example: true
 *                     matchedUser:
 *                       type: null
 *                       example: null
 *                 - type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                       example: true
 *                     isWaiting:
 *                       type: boolean
 *                       example: false
 *                     matchedUser:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           example: uuid
 *                         nickname:
 *                           type: string
 *                           example: 상대닉네임
 *                         birthYear:
 *                           type: number
 *                           example: 1999
 *                         height:
 *                           type: number
 *                           example: 165
 *                         city:
 *                           type: string
 *                           example: Incheon
 *                         profileImages:
 *                           type: array
 *                           items:
 *                             type: string
 *                           example: ["blurred-url1", "blurred-url2", "blurred-url3"]
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.get('/status', checkMatchStatus as unknown as RequestHandler);

/**
 * @swagger
 * /api/match/cancel:
 *   post:
 *     summary: 매칭 요청 취소
 *     tags: [Match]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 매칭 취소 성공
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
 *                   example: 매칭 요청이 취소되었습니다.
 *       400:
 *         description: 취소할 매칭이 없음
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.post('/cancel', cancelMatch as unknown as RequestHandler);

export default router; 