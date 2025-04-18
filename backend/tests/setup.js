// 테스트 환경 설정
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.SUPABASE_URL = 'http://mock-supabase-url';
process.env.SUPABASE_SERVICE_KEY = 'mock-service-key';

// 서버가 자동으로 시작되지 않도록 설정
process.env.NO_SERVER_START = 'true';

// 모킹 설정
jest.mock('../src/utils/supabaseUploader', () => ({
  uploadProfileImage: jest.fn().mockResolvedValue('https://mock-url.com/profile.jpg'),
  uploadBusinessCard: jest.fn().mockResolvedValue('https://mock-url.com/business.jpg'),
  deleteSupabaseFile: jest.fn().mockResolvedValue(undefined)
}));

// 전역 타임아웃 설정 (테스트가 길어질 경우)
jest.setTimeout(30000);

// 테스트 전 DB 초기화 및 마이그레이션 적용
beforeAll(async () => {
  // DB 연결 및 마이그레이션 적용
  const db = require('../models');
  
  // 테스트 시작 시 DB 초기화
  console.log('테스트 DB 초기화 및 마이그레이션 적용 중...');
  
  // 테스트 DB에 마이그레이션 적용
  await db.sequelize.sync({ force: true });
  
  console.log('테스트 DB 설정 완료');
});

// 테스트 후 정리
afterAll(async () => {
  // 테스트 종료 후 필요한 정리 작업
  console.log('테스트 스위트 완료');
}); 