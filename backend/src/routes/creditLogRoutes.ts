import express from 'express';
import { RequestHandler } from 'express-serve-static-core';
import * as creditLogController from '../controllers/creditLogController';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: CreditLogs
 *   description: 크레딧 로그 관리 API
 */

/**
 * @swagger
 * /api/credits:
 *   post:
 *     summary: 크레딧 로그 생성
 *     tags: [CreditLogs]
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
 *               - action
 *               - amount
 *             properties:
 *               userId:
 *                 type: string
 *                 description: 사용자 ID
 *                 example: user-uuid
 *               action:
 *                 type: string
 *                 enum: [CHARGE, MATCH, PROFILE_UNLOCK]
 *                 description: 크레딧 액션 유형
 *                 example: CHARGE
 *               amount:
 *                 type: number
 *                 description: 크레딧 양 (충전은 양수, 사용은 음수)
 *                 example: 50
 *     responses:
 *       201:
 *         description: 크레딧 로그 생성 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 크레딧 로그가 생성되었습니다.
 *                 creditLog:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     userId:
 *                       type: string
 *                     action:
 *                       type: string
 *                     amount:
 *                       type: number
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                 updatedCredit:
 *                   type: number
 *                   example: 100
 *       400:
 *         description: 잘못된 요청 (유효하지 않은 액션 또는 금액)
 *       401:
 *         description: 인증 실패
 *       404:
 *         description: 사용자를 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.post('/', creditLogController.createCreditLog as unknown as RequestHandler);

/**
 * @swagger
 * /api/credits/user/{userId}:
 *   get:
 *     summary: 특정 사용자의 크레딧 로그 조회
 *     tags: [CreditLogs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: 사용자 ID
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
 *           default: 20
 *         description: 페이지당 항목 수
 *     responses:
 *       200:
 *         description: 크레딧 로그 목록
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalLogs:
 *                   type: integer
 *                   example: 45
 *                 totalPages:
 *                   type: integer
 *                   example: 3
 *                 currentPage:
 *                   type: integer
 *                   example: 1
 *                 logs:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       userId:
 *                         type: string
 *                       action:
 *                         type: string
 *                         enum: [CHARGE, MATCH, PROFILE_UNLOCK]
 *                       amount:
 *                         type: number
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                 currentCredit:
 *                   type: number
 *                   example: 120
 *       401:
 *         description: 인증 실패
 *       404:
 *         description: 사용자를 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.get('/user/:userId', creditLogController.getUserCreditLogs as unknown as RequestHandler);

/**
 * @swagger
 * /api/credits/{logId}:
 *   get:
 *     summary: 특정 크레딧 로그 조회
 *     tags: [CreditLogs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: logId
 *         required: true
 *         schema:
 *           type: string
 *         description: 크레딧 로그 ID
 *     responses:
 *       200:
 *         description: 크레딧 로그 정보
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 userId:
 *                   type: string
 *                 action:
 *                   type: string
 *                   enum: [CHARGE, MATCH, PROFILE_UNLOCK]
 *                 amount:
 *                   type: number
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: 인증 실패
 *       404:
 *         description: 크레딧 로그를 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.get('/:logId', creditLogController.getCreditLog as unknown as RequestHandler);

/**
 * @swagger
 * /api/credits/charge:
 *   post:
 *     summary: 크레딧 충전
 *     tags: [CreditLogs]
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
 *               - amount
 *             properties:
 *               userId:
 *                 type: string
 *                 description: 사용자 ID
 *                 example: user-uuid
 *               amount:
 *                 type: number
 *                 description: 충전할 크레딧 양 (양수)
 *                 example: 50
 *     responses:
 *       201:
 *         description: 크레딧 충전 성공
 *       400:
 *         description: 잘못된 요청 (유효하지 않은 금액)
 *       401:
 *         description: 인증 실패
 *       404:
 *         description: 사용자를 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.post('/charge', creditLogController.chargeCredit as unknown as RequestHandler);

/**
 * @swagger
 * /api/credits/use/match:
 *   post:
 *     summary: 매칭 서비스에 크레딧 사용
 *     tags: [CreditLogs]
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
 *               - amount
 *             properties:
 *               userId:
 *                 type: string
 *                 description: 사용자 ID
 *                 example: user-uuid
 *               amount:
 *                 type: number
 *                 description: 사용할 크레딧 양 (음수)
 *                 example: -10
 *     responses:
 *       201:
 *         description: 크레딧 사용 성공
 *       400:
 *         description: 잘못된 요청 (유효하지 않은 금액)
 *       401:
 *         description: 인증 실패
 *       404:
 *         description: 사용자를 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.post('/use/match', creditLogController.useMatchCredit as unknown as RequestHandler);

/**
 * @swagger
 * /api/credits/use/profile-unlock:
 *   post:
 *     summary: 프로필 잠금해제에 크레딧 사용
 *     tags: [CreditLogs]
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
 *               - amount
 *             properties:
 *               userId:
 *                 type: string
 *                 description: 사용자 ID
 *                 example: user-uuid
 *               amount:
 *                 type: number
 *                 description: 사용할 크레딧 양 (음수)
 *                 example: -20
 *     responses:
 *       201:
 *         description: 크레딧 사용 성공
 *       400:
 *         description: 잘못된 요청 (유효하지 않은 금액)
 *       401:
 *         description: 인증 실패
 *       404:
 *         description: 사용자를 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.post('/use/profile-unlock', creditLogController.useProfileUnlockCredit as unknown as RequestHandler);

export default router; 