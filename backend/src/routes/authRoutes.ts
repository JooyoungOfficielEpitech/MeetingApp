import express from 'express';
import { RequestHandler } from 'express-serve-static-core';
import { register, login, socialLogin, socialRegister } from '../controllers/authController';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: 인증 관련 API
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: 일반 회원가입
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - nickname
 *               - birthYear
 *               - height
 *               - city
 *               - gender
 *               - profileImages
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: password123
 *               nickname:
 *                 type: string
 *                 example: 사용자닉네임
 *               birthYear:
 *                 type: number
 *                 example: 1990
 *               height:
 *                 type: number
 *                 example: 175
 *               city:
 *                 type: string
 *                 example: Seoul
 *               gender:
 *                 type: string
 *                 enum: [male, female]
 *                 example: male
 *               profileImages:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["image-url1", "image-url2"]
 *               businessCardImage:
 *                 type: string
 *                 example: "business-card-url"
 *                 description: "남성 사용자에게만 적용 가능한 필드입니다."
 *     responses:
 *       201:
 *         description: 회원가입 성공
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
 *                   example: 회원가입 완료
 *                 userId:
 *                   type: string
 *                   example: user-id
 *       400:
 *         description: 잘못된 입력 데이터 (필수 정보 누락, 중복 이메일 등)
 *       409:
 *         description: 이미 등록된 이메일
 *       500:
 *         description: 서버 오류
 */
router.post('/register', register as unknown as RequestHandler);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: 일반 로그인
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: password123
 *     responses:
 *       200:
 *         description: 로그인 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 token:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: user-id
 *                     nickname:
 *                       type: string
 *                       example: 사용자닉네임
 *                     gender:
 *                       type: string
 *                       enum: [male, female]
 *                       example: male
 *                     credit:
 *                       type: number
 *                       example: 50
 *       400:
 *         description: 잘못된 입력 데이터
 *       401:
 *         description: 이메일 또는 비밀번호가 일치하지 않음
 *       500:
 *         description: 서버 오류
 */
router.post('/login', login as unknown as RequestHandler);

/**
 * @swagger
 * /api/auth/social-login:
 *   post:
 *     summary: 소셜 로그인
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - provider
 *               - token
 *             properties:
 *               provider:
 *                 type: string
 *                 enum: [google, kakao]
 *                 example: google
 *               token:
 *                 type: string
 *                 example: oauth-token-from-provider
 *     responses:
 *       200:
 *         description: 로그인 성공
 *       401:
 *         description: 잘못된 소셜 토큰
 *       404:
 *         description: 존재하지 않는 계정(소셜 회원가입 필요)
 *       500:
 *         description: 서버 오류
 */
router.post('/social-login', socialLogin as unknown as RequestHandler);

/**
 * @swagger
 * /api/auth/social-register:
 *   post:
 *     summary: 소셜 회원가입
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - provider
 *               - nickname
 *               - birthYear
 *               - height
 *               - city
 *               - gender
 *               - profileImages
 *             properties:
 *               provider:
 *                 type: string
 *                 enum: [google, kakao]
 *                 example: google
 *               socialEmail:
 *                 type: string
 *                 format: email
 *                 example: user@gmail.com
 *               nickname:
 *                 type: string
 *                 example: 소셜사용자
 *               birthYear:
 *                 type: number
 *                 example: 1990
 *               height:
 *                 type: number
 *                 example: 175
 *               city:
 *                 type: string
 *                 example: Seoul
 *               gender:
 *                 type: string
 *                 enum: [male, female]
 *                 example: male
 *               profileImages:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["image-url1", "image-url2"]
 *               businessCardImage:
 *                 type: string
 *                 example: "business-card-url"
 *                 description: "남성 사용자에게만 적용 가능한 필드입니다."
 *     responses:
 *       201:
 *         description: 회원가입 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 token:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: user-id
 *                     nickname:
 *                       type: string
 *                       example: 소셜사용자
 *                     gender:
 *                       type: string
 *                       enum: [male, female]
 *                       example: male
 *                     credit:
 *                       type: number
 *                       example: 50
 *       400:
 *         description: 잘못된 입력 데이터 (필수 정보 누락, 중복 이메일 등)
 *       401:
 *         description: 잘못된 소셜 토큰
 *       409:
 *         description: 이미 가입된 사용자
 *       500:
 *         description: 서버 오류
 */
router.post('/social-register', socialRegister as unknown as RequestHandler);

export default router; 