import express, { Application } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './config/db';
import userRoutes from './routes/userRoutes';
import matchQueueRoutes from './routes/matchQueueRoutes';
import chatRoomRoutes from './routes/chatRoomRoutes';
import messageRoutes from './routes/messageRoutes';
import creditLogRoutes from './routes/creditLogRoutes';
import adminRoutes from './routes/adminRoutes';
import authRoutes from './routes/authRoutes';
import userProfileRoutes from './routes/userProfileRoutes';
import matchRoutes from './routes/matchRoutes';
import chatRoutes from './routes/chatRoutes';
import creditRoutes from './routes/creditRoutes';
import { specs, swaggerUi } from './config/swagger';
import path from 'path';

// 환경 변수 설정
dotenv.config();

// MongoDB 연결
connectDB();

const app: Application = express();

// 미들웨어
app.use(cors({
  origin: '*', // 모든 출처 허용
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger UI 설정
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, { explorer: true }));

// Swagger JSON 파일을 정적 파일로 제공
app.use('/swagger', express.static(path.join(__dirname, '../swagger')));

// 라우트
app.use('/api/auth', authRoutes);
app.use('/api/user', userProfileRoutes);
app.use('/api/users', userRoutes);
app.use('/api/match', matchRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/queue', matchQueueRoutes);
app.use('/api/chat-rooms', chatRoomRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/credits', creditLogRoutes);
app.use('/api/credit', creditRoutes);
app.use('/api/admin', adminRoutes);

// 기본 라우트
app.get('/', (req, res) => {
  res.send('API 실행 중...');
});

// 에러 핸들러
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).send({ message: '서버 에러가 발생했습니다.' });
});

export default app; 