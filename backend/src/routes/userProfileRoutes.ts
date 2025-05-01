import express from 'express';
import { RequestHandler } from 'express-serve-static-core';
import { getMyProfile, updateMyProfile } from '../controllers/userProfileController';
import { protect } from '../middleware/userAuthMiddleware';

const router = express.Router();

// 모든 라우트에 인증 미들웨어 적용
router.use(protect as RequestHandler);

/**
 * @swagger
 * tags:
 *   name: UserProfile
 *   description: 사용자 프로필 관리 API
 */

/**
 * @swagger
 * /api/user/profile:
 *   get:
 *     summary: 내 프로필 정보 조회
 *     tags: [UserProfile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 프로필 정보
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 profile:
 *                   type: object
 *                   properties:
 *                     nickname:
 *                       type: string
 *                       example: 사용자닉네임
 *                     birthYear:
 *                       type: number
 *                       example: 1990
 *                     height:
 *                       type: number
 *                       example: 175
 *                     city:
 *                       type: string
 *                       example: Seoul
 *                     profileImages:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["image-url1", "image-url2"]
 *                     gender:
 *                       type: string
 *                       enum: [male, female]
 *                       example: male
 *                     credit:
 *                       type: number
 *                       example: 100
 *                     businessCardImage:
 *                       type: string
 *                       example: business-card-url
 *       401:
 *         description: 인증 실패
 *       404:
 *         description: 사용자를 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.get('/profile', getMyProfile as unknown as RequestHandler);

/**
 * @swagger
 * /api/user/profile:
 *   patch:
 *     summary: 내 프로필 정보 수정
 *     tags: [UserProfile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nickname:
 *                 type: string
 *                 example: 새닉네임
 *               birthYear:
 *                 type: number
 *                 example: 1995
 *               height:
 *                 type: number
 *                 example: 180
 *               city:
 *                 type: string
 *                 example: Busan
 *               profileImages:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["new-image1", "new-image2", "new-image3"]
 *               businessCardImage:
 *                 type: string
 *                 example: new-business-card-url
 *     responses:
 *       200:
 *         description: 프로필 수정 성공
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
 *                   example: 프로필 수정 완료
 *       400:
 *         description: 잘못된 요청 (프로필 이미지 초과 등)
 *       401:
 *         description: 인증 실패
 *       404:
 *         description: 사용자를 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.patch('/profile', updateMyProfile as unknown as RequestHandler);

export default router; 