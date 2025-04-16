import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl) {
  throw new Error('Missing environment variable: SUPABASE_URL');
}

if (!supabaseServiceKey) {
  throw new Error('Missing environment variable: SUPABASE_SERVICE_KEY');
}

// Supabase 클라이언트 생성 (서비스 키 사용)
// 서버 측에서만 사용해야 합니다.
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    // 자동 새로고침 비활성화 (서버 환경에서는 필요 없음)
    autoRefreshToken: false,
    // 영구 세션 비활성화 (서버 환경에서는 필요 없음)
    persistSession: false,
  },
});

export default supabaseAdmin; 