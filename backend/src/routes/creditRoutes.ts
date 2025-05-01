import express from 'express';
import { RequestHandler } from 'express-serve-static-core';
import { getCreditLogs, chargeCredit, getCreditUsageInfo, getCurrentCredit, useCredit } from '../controllers/creditController';
import { protect } from '../middleware/userAuthMiddleware';

const router = express.Router();

// 모든 라우트에 인증 미들웨어 적용
router.use(protect as RequestHandler);

/**
 * @swagger
 * tags:
 *   name: Credits
 *   description: 크레딧 관리 API
 */

/**
 * @swagger
 * /api/credit/logs:
 *   get:
 *     summary: 크레딧 사용 내역 조회
 *     tags: [Credits]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 크레딧 사용 내역 목록
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       action:
 *                         type: string
 *                         example: 'match'
 *                       amount:
 *                         type: number
 *                         example: -10
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         example: '2023-01-01T12:00:00Z'
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.get('/logs', getCreditLogs as unknown as RequestHandler);

/**
 * @swagger
 * /api/credit/usage-info:
 *   get:
 *     summary: 크레딧 사용 정보 조회
 *     tags: [Credits]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 크레딧 사용 정보
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     matching:
 *                       type: object
 *                       properties:
 *                         description:
 *                           type: string
 *                           example: '매칭 서비스 이용'
 *                         cost:
 *                           type: number
 *                           example: 10
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.get('/usage-info', getCreditUsageInfo as unknown as RequestHandler);

/**
 * @swagger
 * /api/credit/charge:
 *   post:
 *     summary: 크레딧 충전
 *     tags: [Credits]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: number
 *                 description: 충전할 크레딧 양
 *                 example: 50
 *               description:
 *                 type: string
 *                 description: 충전 내역 설명
 *                 example: '크레딧 충전'
 *     responses:
 *       200:
 *         description: 충전 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *       400:
 *         description: 잘못된 요청
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.post('/charge', chargeCredit as unknown as RequestHandler);

/**
 * @swagger
 * /api/credit/use:
 *   post:
 *     summary: 크레딧 사용
 *     tags: [Credits]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - service
 *             properties:
 *               amount:
 *                 type: number
 *                 description: 사용할 크레딧 양
 *                 example: 10
 *               service:
 *                 type: string
 *                 description: 서비스 유형
 *                 example: 'match'
 *               description:
 *                 type: string
 *                 description: 사용 내역 설명
 *                 example: '매칭 서비스 이용'
 *     responses:
 *       200:
 *         description: 크레딧 사용 성공
 *       400:
 *         description: 잘못된 요청
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.post('/use', useCredit as unknown as RequestHandler);

/**
 * @swagger
 * /api/credit/current:
 *   get:
 *     summary: 현재 크레딧 잔액 조회
 *     tags: [Credits]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 크레딧 잔액
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     credit:
 *                       type: number
 *                       example: 100
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.get('/current', getCurrentCredit as unknown as RequestHandler);

export default router; 