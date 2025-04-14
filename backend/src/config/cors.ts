import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

// 환경 변수에서 허용할 도메인 목록을 가져옵니다
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

// 추가 도메인이 필요한 경우 콤마로 구분해서 환경 변수에 추가할 수 있습니다
const additionalOrigins = process.env.ADDITIONAL_ALLOWED_ORIGINS 
  ? process.env.ADDITIONAL_ALLOWED_ORIGINS.split(',') 
  : [];

const allowedOrigins = [
  frontendUrl,
  // 개발 중 localhost는 항상 포함
  'http://localhost:3000',
  // 필요한 경우 이전 배포 URL들도 유지 (나중에 정리 가능)
  'https://meeting-app-frontend-three.vercel.app',
  'https://meeting-app-frontend.vercel.app',
  'https://meetingapp-frontend.vercel.app',
  // 추가 도메인 배열 병합
  ...additionalOrigins
];

console.log('[CORS] Allowed origins:', allowedOrigins);

export const corsOptions: cors.CorsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
};

export const corsMiddleware = cors(corsOptions); 