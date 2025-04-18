const request = require('supertest');
const { app } = require('../../src/server');
const db = require('../../models');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../../src/config/jwt');

describe('매칭 시스템 통합 테스트', () => {
  let maleToken, femaleToken;
  let maleUserId, femaleUserId;
  
  // 테스트 전에 데이터베이스 초기화 및 테스트 사용자 생성
  beforeAll(async () => {
    // 테스트용 테이블 초기화
    if (process.env.NODE_ENV === 'test') {
      // SQLite에서는 FOREIGN_KEY_CHECKS를 사용하지 않음
      await db.User.destroy({ where: {}, force: true });
      await db.Match.destroy({ where: {}, force: true });
      await db.MatchingWaitList.destroy({ where: {}, force: true });
    } else {
      await db.sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');
      await db.User.destroy({ where: {}, force: true });
      await db.Match.destroy({ where: {}, force: true });
      await db.MatchingWaitList.destroy({ where: {}, force: true });
      await db.sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');
    }
    
    // 남성 사용자 생성
    const maleUser = await db.User.create({
      email: 'male-test@example.com',
      passwordHash: '$2b$10$X7LPPzSZVxaLqQdYpzPJKOBGRGGh9WWUY6w9WvS7kYhRMQH/yYifK', // 'Password123!'
      name: '남성 테스트 유저',
      nickname: '남성닉네임',
      gender: 'male',
      age: 30,
      height: 180,
      mbti: 'ESTJ',
      city: 'seoul',
      status: 'active',
      profileImageUrls: ['https://example.com/dummy-male.jpg'],
      businessCardImageUrl: 'https://example.com/dummy-business-male.jpg'
    });
    
    maleUserId = maleUser.id;
    
    // 여성 사용자 생성
    const femaleUser = await db.User.create({
      email: 'female-test@example.com',
      passwordHash: '$2b$10$X7LPPzSZVxaLqQdYpzPJKOBGRGGh9WWUY6w9WvS7kYhRMQH/yYifK', // 'Password123!'
      name: '여성 테스트 유저',
      nickname: '여성닉네임',
      gender: 'female',
      age: 28,
      height: 165,
      mbti: 'INFJ',
      city: 'seoul',
      status: 'active',
      profileImageUrls: ['https://example.com/dummy-female.jpg'],
      businessCardImageUrl: 'https://example.com/dummy-business-female.jpg'
    });
    
    femaleUserId = femaleUser.id;
    
    // 토큰 생성
    maleToken = jwt.sign({
      userId: maleUser.id,
      email: maleUser.email,
      status: 'active',
      gender: 'male'
    }, JWT_SECRET, { expiresIn: '1h' });
    
    femaleToken = jwt.sign({
      userId: femaleUser.id,
      email: femaleUser.email,
      status: 'active',
      gender: 'female'
    }, JWT_SECRET, { expiresIn: '1h' });
  });
  
  afterAll(async () => {
    // 연결 종료
    await db.sequelize.close();
  });
  
  // 매칭 시작 테스트
  describe('매칭 시작 (POST /api/matches/start)', () => {
    test('인증된 여성 사용자의 매칭 시작 성공', async () => {
      // 먼저 대기열에서 제거 (이미 있을 경우)
      await db.MatchingWaitList.destroy({
        where: { userId: femaleUserId }
      });
      
      const res = await request(app)
        .post('/api/matches/start')
        .set('Authorization', `Bearer ${femaleToken}`);
      
      // 성공 응답이 오면 됨 (202 또는 200)
      expect(res.statusCode).toBe(202);
      expect(res.body).toHaveProperty('message');
      expect(res.body.message).toContain('Searching for a match');
      
      // 대기열에 추가되었는지 확인
      const waitlistEntry = await db.MatchingWaitList.findOne({
        where: { userId: femaleUserId }
      });
      
      // 바로 매칭되지 않았다면 대기열에 있어야 함
      if (waitlistEntry) {
        expect(waitlistEntry.gender).toBe('female');
      } else {
        // 바로 매칭되었다면 매칭 테이블에 있어야 함
        const match = await db.Match.findOne({
          where: {
            [db.Sequelize.Op.or]: [
              { user1Id: femaleUserId },
              { user2Id: femaleUserId }
            ]
          }
        });
        
        if (match) {
          expect(match).not.toBeNull();
        } else {
          // 대기열에서도 매치에서도 찾을 수 없는 경우는 없어야 함
          expect(waitlistEntry).not.toBeNull();
        }
      }
    });
    
    test('남성 사용자의 매칭 시작 실패', async () => {
      const res = await request(app)
        .post('/api/matches/start')
        .set('Authorization', `Bearer ${maleToken}`);
      
      // 남성은 매칭 시작 불가 - 403 응답 확인
      expect(res.statusCode).toBe(403);
      expect(res.body).toHaveProperty('message');
      expect(res.body.message).toContain('female');
    });
  });
  
  // 매칭 중지 테스트
  describe('매칭 중지 (POST /api/matches/stop)', () => {
    // 먼저, 여성 사용자를 대기열에 추가
    beforeEach(async () => {
      // 기존 대기열 항목 제거
      await db.MatchingWaitList.destroy({
        where: { userId: femaleUserId }
      });
      
      // 대기열에 추가
      await request(app)
        .post('/api/matches/start')
        .set('Authorization', `Bearer ${femaleToken}`);
    });
    
    test('매칭 중지 성공', async () => {
      const res = await request(app)
        .post('/api/matches/stop')
        .set('Authorization', `Bearer ${femaleToken}`);
      
      expect(res.statusCode).toBe(200);
      
      // 대기열에서 제거되었는지 확인
      const waitlistEntry = await db.MatchingWaitList.findOne({
        where: { userId: femaleUserId }
      });
      
      expect(waitlistEntry).toBeNull();
    });
    
    test('대기열에 없는 사용자의 매칭 중지 요청', async () => {
      // 남성 사용자는 대기열에 없음
      const res = await request(app)
        .post('/api/matches/stop')
        .set('Authorization', `Bearer ${maleToken}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('message');
      expect(res.body.message).toContain('not actively searching');
    });
  });
  
  // 매칭 상태 확인 테스트
  describe('매칭 상태 확인 (GET /api/matches/check)', () => {
    test('매칭 상태 확인 성공', async () => {
      const res = await request(app)
        .get('/api/matches/check')
        .set('Authorization', `Bearer ${femaleToken}`);
      
      // 성공 응답 확인 (204 No Content 또는 200 OK)
      expect([200, 204]).toContain(res.statusCode);
      
      // 204 No Content 응답이면 body가 비어있을 수 있음
      if (res.statusCode === 200) {
        expect(res.body).toHaveProperty('isWaiting');
      }
    });
  });
  
  // 활성 매칭 조회 테스트
  describe('활성 매칭 조회 (GET /api/matches/active)', () => {
    test('활성 매칭 조회 성공', async () => {
      const res = await request(app)
        .get('/api/matches/active')
        .set('Authorization', `Bearer ${femaleToken}`);
      
      // 성공 응답 또는 매치 없음 응답 확인
      expect([200, 404]).toContain(res.statusCode);
      
      // 매치가 있는 경우 (200 OK)
      if (res.statusCode === 200) {
        expect(res.body).toHaveProperty('match');
        if (res.body.match) {
          expect(res.body.match).toHaveProperty('matchId');
        }
      }
      // 매치가 없는 경우 (404 Not Found)
      else if (res.statusCode === 404) {
        expect(res.body).toHaveProperty('message');
      }
    });
  });
}); 