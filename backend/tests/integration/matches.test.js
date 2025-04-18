const request = require('supertest');
const { app } = require('../../src/server');
const db = require('../../models');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../../src/config/jwt');

describe('매칭 API 인증 테스트', () => {
  // 인증 실패 테스트만 실행
  
  // 매칭 시작 테스트
  describe('매칭 시작 (POST /api/matches/start)', () => {
    test('인증 없이 매칭 시작 요청 실패', async () => {
      const res = await request(app)
        .post('/api/matches/start');
      
      expect(res.statusCode).toBe(401);
    });
  });
  
  // 매칭 중지 테스트
  describe('매칭 중지 (POST /api/matches/stop)', () => {
    test('인증 없이 매칭 중지 요청 실패', async () => {
      const res = await request(app)
        .post('/api/matches/stop');
      
      expect(res.statusCode).toBe(401);
    });
  });
  
  // 매칭 점검 테스트
  describe('매칭 상태 확인 (GET /api/matches/check)', () => {
    test('인증 없이 매칭 점검 요청 실패', async () => {
      const res = await request(app)
        .get('/api/matches/check');
      
      expect(res.statusCode).toBe(401);
    });
  });
  
  // 활성 매칭 조회 테스트
  describe('활성 매칭 조회 (GET /api/matches/active)', () => {
    test('인증 없이 활성 매칭 조회 요청 실패', async () => {
      const res = await request(app)
        .get('/api/matches/active');
      
      expect(res.statusCode).toBe(401);
    });
  });
}); 