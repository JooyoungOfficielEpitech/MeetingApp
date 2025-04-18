const request = require('supertest');
const { app } = require('../../src/server');
const db = require('../../models');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../../src/config/jwt');
const { v4: uuidv4 } = require('uuid');

describe('메시지 API 통합 테스트', () => {
  // 테스트 사용자
  let user1Token, user2Token;
  let user1Id, user2Id;
  let matchId;
  
  beforeAll(async () => {
    // 테스트용 테이블 초기화
    if (process.env.NODE_ENV === 'test') {
      // SQLite에서는 FOREIGN_KEY_CHECKS를 사용하지 않음
      await db.User.destroy({ where: {}, force: true });
      await db.Profile.destroy({ where: {}, force: true });
      await db.Match.destroy({ where: {}, force: true });
      await db.Like.destroy({ where: {}, force: true });
      await db.Message.destroy({ where: {}, force: true });
    } else {
      await db.sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');
      await db.User.destroy({ where: {}, force: true });
      await db.Profile.destroy({ where: {}, force: true });
      await db.Match.destroy({ where: {}, force: true });
      await db.Like.destroy({ where: {}, force: true });
      await db.Message.destroy({ where: {}, force: true });
      await db.sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');
    }
    
    // 직접 테스트 사용자 생성 (API 요청 대신 데이터베이스에 직접 생성)
    const user1 = await db.User.create({
      email: 'message-test1@example.com',
      passwordHash: '$2b$10$X7LPPzSZVxaLqQdYpzPJKOBGRGGh9WWUY6w9WvS7kYhRMQH/yYifK', // 'Password123!'
      name: '메시지테스트1',
      nickname: '메시지1',
      gender: 'male',
      age: 30,
      height: 180,
      weight: 75,
      city: 'seoul',
      mbti: 'ENFP',
      phone: '010-1234-5678',
      occupation: '개발자',
      income: '5000만원~7000만원',
      profileImageUrls: JSON.stringify(["https://example.com/profile1.jpg"]),
      businessCardImageUrl: "https://example.com/business1.jpg",
      status: 'active'
    });
    
    const user2 = await db.User.create({
      email: 'message-test2@example.com',
      passwordHash: '$2b$10$X7LPPzSZVxaLqQdYpzPJKOBGRGGh9WWUY6w9WvS7kYhRMQH/yYifK', // 'Password123!'
      name: '메시지테스트2',
      nickname: '메시지2',
      gender: 'female',
      age: 25,
      height: 165,
      weight: 50,
      city: 'seoul',
      mbti: 'INFJ',
      phone: '010-8765-4321',
      occupation: '디자이너',
      income: '3000만원~5000만원',
      profileImageUrls: JSON.stringify(["https://example.com/profile2.jpg"]),
      businessCardImageUrl: "https://example.com/business2.jpg",
      status: 'active'
    });
    
    user1Id = user1.id;
    user2Id = user2.id;
    
    // 토큰 생성
    user1Token = jwt.sign({
      userId: user1Id,
      email: user1.email,
      status: 'active'
    }, JWT_SECRET, { expiresIn: '1h' });
    
    user2Token = jwt.sign({
      userId: user2Id,
      email: user2.email,
      status: 'active'
    }, JWT_SECRET, { expiresIn: '1h' });
    
    // 매칭을 직접 데이터베이스에 생성
    matchId = `match-test-${user1Id}-${user2Id}-${Date.now()}`;
    await db.Match.create({
      matchId: matchId,
      user1Id: user1Id,
      user2Id: user2Id,
      isActive: true,
      status: 'active'
    });
    
    console.log(`테스트 매칭 ID 생성됨: ${matchId} (user1Id: ${user1Id}, user2Id: ${user2Id})`);
  });
  
  afterAll(async () => {
    await db.sequelize.close();
  });
  
  // 메시지 전송 테스트
  describe('메시지 전송 (POST /api/messages)', () => {
    test('메시지 전송 성공', async () => {
      const messageData = {
        matchId,
        content: '안녕하세요, 반갑습니다!'
      };
      
      const res = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${user1Token}`)
        .send(messageData);
      
      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('message');
      expect(res.body.message).toHaveProperty('id');
      expect(res.body.message).toHaveProperty('content', messageData.content);
      expect(res.body.message).toHaveProperty('senderId', user1Id);
    });
    
    test('빈 메시지 전송 실패', async () => {
      const messageData = {
        matchId,
        content: ''
      };
      
      const res = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${user1Token}`)
        .send(messageData);
      
      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
    
    test('존재하지 않는 매칭에 메시지 전송 실패', async () => {
      const messageData = {
        matchId: 'non-existent-match-id',
        content: '테스트 메시지'
      };
      
      const res = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${user1Token}`)
        .send(messageData);
      
      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty('error');
    });
    
    test('인증 없이 메시지 전송 실패', async () => {
      const messageData = {
        matchId,
        content: '테스트 메시지'
      };
      
      const res = await request(app)
        .post('/api/messages')
        .send(messageData);
      
      expect(res.statusCode).toBe(401);
    });
  });
  
  // 메시지 목록 조회 테스트
  describe('메시지 목록 조회 (GET /api/messages/:matchId)', () => {
    test('메시지 목록 조회 성공', async () => {
      const res = await request(app)
        .get(`/api/messages/${matchId}`)
        .set('Authorization', `Bearer ${user1Token}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('messages');
      expect(Array.isArray(res.body.messages)).toBe(true);
      expect(res.body.messages.length).toBeGreaterThan(0);
      
      // 앞서 보낸 메시지가 있는지 확인
      const hasMessage = res.body.messages.some(msg => 
        msg.content === '안녕하세요, 반갑습니다!' && msg.senderId === user1Id
      );
      
      expect(hasMessage).toBe(true);
    });
    
    test('상대방도 메시지 목록 조회 성공', async () => {
      const res = await request(app)
        .get(`/api/messages/${matchId}`)
        .set('Authorization', `Bearer ${user2Token}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('messages');
      expect(Array.isArray(res.body.messages)).toBe(true);
    });
    
    test('존재하지 않는 매칭의 메시지 목록 조회 실패', async () => {
      const res = await request(app)
        .get('/api/messages/9999')
        .set('Authorization', `Bearer ${user1Token}`);
      
      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty('error');
    });
    
    test('인증 없이 메시지 목록 조회 실패', async () => {
      const res = await request(app)
        .get(`/api/messages/${matchId}`);
      
      expect(res.statusCode).toBe(401);
    });
    
    test('매칭에 속하지 않은 사용자가 메시지 목록 조회 실패', async () => {
      // 새 사용자 생성
      const user3 = await db.User.create({
        email: 'message-test3@example.com',
        passwordHash: '$2b$10$X7LPPzSZVxaLqQdYpzPJKOBGRGGh9WWUY6w9WvS7kYhRMQH/yYifK', // 'Password123!'
        name: '메시지테스트3',
        status: 'active'
      });
      
      const user3Token = jwt.sign({
        userId: user3.id,
        email: user3.email,
        status: 'active'
      }, JWT_SECRET, { expiresIn: '1h' });
      
      const res = await request(app)
        .get(`/api/messages/${matchId}`)
        .set('Authorization', `Bearer ${user3Token}`);
      
      expect(res.statusCode).toBe(403);
      expect(res.body).toHaveProperty('error');
    });
  });
  
  // 메시지 읽음 표시 테스트
  describe('메시지 읽음 표시 (PUT /api/messages/:matchId/read)', () => {
    test('메시지 읽음 표시 성공', async () => {
      // 사용자2가 메시지 보내기
      await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          matchId,
          content: '네, 안녕하세요!'
        });
      
      // 사용자1이 메시지를 읽음 표시
      const res = await request(app)
        .put(`/api/messages/${matchId}/read`)
        .set('Authorization', `Bearer ${user1Token}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      
      // 메시지 목록 조회하여 읽음 표시 확인
      const messagesRes = await request(app)
        .get(`/api/messages/${matchId}`)
        .set('Authorization', `Bearer ${user1Token}`);
      
      const user2Messages = messagesRes.body.messages.filter(msg => msg.senderId === user2Id);
      const allMessagesRead = user2Messages.every(msg => msg.read === true);
      
      expect(allMessagesRead).toBe(true);
    });
    
    test('인증 없이 메시지 읽음 표시 실패', async () => {
      const res = await request(app)
        .put(`/api/messages/${matchId}/read`);
      
      expect(res.statusCode).toBe(401);
    });
    
    test('존재하지 않는 매칭의 메시지 읽음 표시 실패', async () => {
      const res = await request(app)
        .put('/api/messages/non-existent-match/read')
        .set('Authorization', `Bearer ${user1Token}`);
      
      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty('error');
    });
  });
}); 