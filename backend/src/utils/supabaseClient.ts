import { createClient, SupabaseClient } from '@supabase/supabase-js';

// 환경 변수 로드 및 로깅
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

console.log(`[Supabase Config] URL가 설정됨: ${supabaseUrl ? '예' : '아니오'}`);
console.log(`[Supabase Config] 서비스 키가 설정됨: ${supabaseServiceKey ? '예 (길이: ' + supabaseServiceKey.length + '자)' : '아니오'}`);
// 토큰의 처음 10자와 마지막 10자만 출력 (보안상 전체 토큰은 출력하지 않음)
if (supabaseServiceKey) {
  console.log(`[Supabase Config] 서비스 키 형식: ${supabaseServiceKey.slice(0, 10)}...${supabaseServiceKey.slice(-10)}`);
}

if (!supabaseUrl) {
  throw new Error('Missing environment variable: SUPABASE_URL');
}

if (!supabaseServiceKey) {
  throw new Error('Missing environment variable: SUPABASE_SERVICE_KEY');
}

// Supabase 클라이언트 생성 (서비스 키 사용)
// 서버 측에서만 사용해야 합니다.
console.log('[Supabase Config] 클라이언트 생성 시작...');
let supabaseAdmin: SupabaseClient;

try {
  supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      // 자동 새로고침 비활성화 (서버 환경에서는 필요 없음)
      autoRefreshToken: false,
      // 영구 세션 비활성화 (서버 환경에서는 필요 없음)
      persistSession: false,
    },
  });
  
  console.log('[Supabase Config] 클라이언트 생성 성공');
  
  // 간단한 연결 테스트
  supabaseAdmin.storage.getBucket('profile-images')
    .then(() => console.log('[Supabase Config] 버킷 접근 테스트 성공: profile-images'))
    .catch(err => console.error('[Supabase Config] 버킷 접근 테스트 실패:', err.message));
  
} catch (error) {
  console.error('[Supabase Config] 클라이언트 생성 오류:', error);
  throw error;
}

export default supabaseAdmin; 