const request = require('supertest');
const { app } = require('../../src/server');
const db = require('../../models');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../../src/config/jwt');

describe('관리자 기능 통합 테스트', () => {
  let adminToken, regularToken;
  let userId;
  
  // 테스트 전에 데이터베이스 초기화 및 사용자 생성
  beforeAll(async () => {
    // 테스트용 테이블 초기화
    if (process.env.NODE_ENV === 'test') {
      // SQLite에서는 FOREIGN_KEY_CHECKS를 사용하지 않음
      await db.User.destroy({ where: {}, force: true });
    } else {
      await db.sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');
      await db.User.destroy({ where: {}, force: true });
      await db.sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');
    }
    
    // 관리자 계정 생성
    const admin = await db.User.create({
      email: 'admin-test@example.com',
      passwordHash: '$2b$10$X7LPPzSZVxaLqQdYpzPJKOBGRGGh9WWUY6w9WvS7kYhRMQH/yYifK', // 'Password123!'
      name: '관리자 테스트',
      isAdmin: true,
      status: 'active'
    });
    
    // 일반 사용자 계정 생성 (승인 대기 상태)
    const user = await db.User.create({
      email: 'pending-test@example.com',
      passwordHash: '$2b$10$X7LPPzSZVxaLqQdYpzPJKOBGRGGh9WWUY6w9WvS7kYhRMQH/yYifK', // 'Password123!'
      name: '승인 대기 사용자',
      nickname: '대기닉네임',
      gender: 'male',
      age: 27,
      height: 178,
      mbti: 'INTP',
      city: 'seoul',
      status: 'pending_approval',
      profileImageUrls: ['https://example.com/dummy-pending.jpg'],
      businessCardImageUrl: 'https://example.com/dummy-business-pending.jpg'
    });
    
    userId = user.id;
    
    // 토큰 생성
    adminToken = jwt.sign({
      userId: admin.id,
      email: admin.email,
      status: 'active',
      isAdmin: true
    }, JWT_SECRET, { expiresIn: '1h' });
    
    regularToken = jwt.sign({
      userId: user.id,
      email: user.email,
      status: 'pending_approval',
      gender: 'male'
    }, JWT_SECRET, { expiresIn: '1h' });
  });
  
  afterAll(async () => {
    // 연결 종료
    await db.sequelize.close();
  });
  
  // 관리자 대시보드 테스트
  describe('관리자 대시보드', () => {
    test('대시보드 통계 조회 - 관리자 권한', async () => {
      const res = await request(app)
        .get('/api/admin/stats/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('totalUsers');
      expect(res.body).toHaveProperty('pendingApprovalCount');
      expect(res.body.totalUsers).toBeGreaterThanOrEqual(2); // 최소 2명 (admin + regular)
    });
    
    test('대시보드 통계 조회 - 권한 없음', async () => {
      const res = await request(app)
        .get('/api/admin/stats/dashboard')
        .set('Authorization', `Bearer ${regularToken}`);
      
      expect(res.statusCode).toBe(403);
    });
  });
  
  // 사용자 관리 테스트
  describe('사용자 관리', () => {
    test('사용자 목록 조회', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('users');
      expect(res.body.users.length).toBeGreaterThanOrEqual(2);
      
      // pending_approval 상태의 사용자가 있는지 확인
      const pendingUser = res.body.users.find(u => u.status === 'pending_approval');
      expect(pendingUser).not.toBeUndefined();
    });
    
    test('사용자 승인', async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${userId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('message', 'User approved successfully');
      
      // 데이터베이스에서 직접 확인
      const updatedUser = await db.User.findByPk(userId);
      expect(updatedUser.status).toBe('active');
    });
    
    test('사용자 거부', async () => {
      const userId = 2;
      const reason = '프로필 사진이 명확하지 않음';
      
      // 사용자 상태 초기화
      await db.User.update({ status: 'pending_approval' }, { where: { id: userId } });
      
      const res = await request(app)
        .patch(`/api/admin/users/${userId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason });
      
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('message', 'User rejected successfully.');
      
      // 데이터베이스에서 직접 확인
      const updatedUser = await db.User.findByPk(userId);
      expect(updatedUser.status).toBe('rejected');
      expect(updatedUser.rejectionReason).toBe(reason);
    });
  });
  
  // 매칭 관리 테스트
  describe('매칭 관리', () => {
    test('최근 매칭 목록 조회', async () => {
      const res = await request(app)
        .get('/api/admin/matches/recent')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(res.statusCode).toBe(200);
      // matches 속성 검사 대신 일반 배열로 반환되는지 확인
      expect(Array.isArray(res.body)).toBe(true);
      // 매칭이 없을 수도 있음
    });
  });
}); 