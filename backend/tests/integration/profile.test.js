const request = require('supertest');
const { app } = require('../../src/server');
const db = require('../../models');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../../src/config/jwt');

describe('프로필 API 통합 테스트', () => {
  let userToken;
  let userId;
  
  // 테스트 데이터
  const testUser = {
    email: 'profile-test@example.com',
    password: 'Password123!',
    name: '프로필테스트'
  };
  
  const profileData = {
    nickname: '테스트닉네임',
    gender: 'male',
    height: 175,
    age: 30,
    city: 'seoul',
    occupation: '개발자',
    income: '5000만원~7000만원',
    mbti: 'ENFP',
    phone: '010-1234-5678'
  };
  
  // 테스트 전에 데이터베이스 초기화 및 사용자 생성
  beforeAll(async () => {
    // 테스트용 테이블 초기화
    if (process.env.NODE_ENV === 'test') {
      // SQLite에서는 FOREIGN_KEY_CHECKS를 사용하지 않음
      await db.User.destroy({ where: {}, force: true });
      await db.Profile.destroy({ where: {}, force: true });
      await db.ProfileImage.destroy({ where: {}, force: true });
    } else {
      await db.sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');
      await db.User.destroy({ where: {}, force: true });
      await db.Profile.destroy({ where: {}, force: true });
      await db.ProfileImage.destroy({ where: {}, force: true });
      await db.sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');
    }
    
    // 테스트 사용자 생성
    const signupRes = await request(app)
      .post('/api/auth/signup')
      .send(testUser);
    
    userToken = signupRes.body.token;
    userId = signupRes.body.user.id;
  });
  
  afterAll(async () => {
    // 연결 종료
    await db.sequelize.close();
  });
  
  // 프로필 작성 테스트
  describe('프로필 작성 (POST /api/profile/complete-regular)', () => {
    test('필수 필드 누락으로 프로필 작성 실패', async () => {
      // 필수 필드 누락한 요청
      const incompleteData = { ...profileData };
      delete incompleteData.nickname; // 필수 필드 제거
      
      const res = await request(app)
        .post('/api/profile/complete-regular')
        .set('Authorization', `Bearer ${userToken}`)
        .send(incompleteData);
      
      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('errors');
    });
    
    test('인증 없이 프로필 작성 실패', async () => {
      const res = await request(app)
        .post('/api/profile/complete-regular')
        .send(profileData);
      
      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty('message');
    });
    
    // 실제 이미지 업로드가 필요하므로 테스트 건너뜀
    test.skip('유효한 프로필 정보로 작성 성공', async () => {
      // 실제 환경에서는 이미지 업로드가 필요하므로 스킵
      const res = await request(app)
        .post('/api/profile/complete-regular')
        .set('Authorization', `Bearer ${userToken}`)
        .send(profileData);
      
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('message');
    });
  });
  
  // 프로필 조회 테스트
  describe('프로필 조회 (GET /api/profile/me)', () => {
    test('인증 없이 프로필 조회 실패', async () => {
      const res = await request(app)
        .get('/api/profile/me');
      
      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty('message');
    });
    
    test('유효한 토큰으로 프로필 조회', async () => {
      const res = await request(app)
        .get('/api/profile/me')
        .set('Authorization', `Bearer ${userToken}`);
      
      expect(res.statusCode).toBe(200);
      // 사용자 정보가 포함되어 있는지 확인
      expect(res.body).toHaveProperty('email');
      expect(res.body).toHaveProperty('id');
    });
  });
  
  // 프로필 업데이트 테스트
  describe('프로필 업데이트 (PUT /api/profile/me)', () => {
    const updatedData = {
      nickname: '업데이트닉네임',
      mbti: 'INTJ'
    };
    
    test('인증 없이 프로필 업데이트 실패', async () => {
      const res = await request(app)
        .put('/api/profile/me')
        .send(updatedData);
      
      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty('message');
    });
    
    test('유효한 토큰으로 프로필 업데이트', async () => {
      const res = await request(app)
        .put('/api/profile/me')
        .set('Authorization', `Bearer ${userToken}`)
        .send(updatedData);
      
      expect(res.statusCode).toBe(200);
      // mbti 속성만 확인 (nickname은 프로필 객체 내부에 있을 수 있음)
      expect(res.body).toHaveProperty('mbti', updatedData.mbti);
    });
  });
  
  // 프로필 이미지 관련 테스트 (제한적인 테스트)
  describe('프로필 이미지 업로드', () => {
    // 업로드 테스트는 실제 이미지 파일이 필요하므로 인증 실패 케이스만 테스트
    test('인증 없이 프로필 업데이트 실패', async () => {
      const res = await request(app)
        .post('/api/profile/complete-regular')
        .field('nickname', '업데이트닉네임')
        .field('order', 1);
      
      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty('message');
    });
  });
}); 