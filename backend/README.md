# 사용자 관리 API

MongoDB를 사용한 사용자 관리 API입니다.

## 요구 사항

- Node.js v14 이상
- MongoDB 설치 또는 MongoDB Atlas 연결 정보

## 설치 및 실행

1. 의존성 패키지 설치
   ```bash
   npm install
   ```

2. 환경 변수 설정
   `.env` 파일을 생성하고 다음 내용을 입력합니다.
   ```
   PORT=5000
   MONGO_URI=mongodb://localhost:27017/amie
   NODE_ENV=development
   ```

3. 개발 모드 실행
   ```bash
   npm run dev
   ```

4. 빌드 및 프로덕션 실행
   ```bash
   npm run build
   npm start
   ```

## API 엔드포인트

### 사용자

- `POST /api/users` - 새 사용자 생성
- `GET /api/users` - 모든 사용자 조회
- `GET /api/users/:id` - 특정 사용자 조회
- `PUT /api/users/:id` - 사용자 정보 업데이트
- `DELETE /api/users/:id` - 사용자 삭제
- `POST /api/users/:id/credit` - 사용자 크레딧 충전

### 매칭 대기열

- `POST /api/queue/join` - 매칭 대기열 참가
- `PUT /api/queue/:userId/leave` - 매칭 대기 취소
- `GET /api/queue/:userId/status` - 사용자 대기 상태 확인
- `GET /api/queue/:userId/match` - 매칭 알고리즘 실행
- `GET /api/queue` - 모든 대기열 항목 조회 (관리자용)

### 채팅방

- `POST /api/chat-rooms` - 새 채팅방 생성
- `GET /api/chat-rooms/user/:userId` - 사용자의 모든 채팅방 조회
- `GET /api/chat-rooms/:roomId` - 특정 채팅방 조회
- `PUT /api/chat-rooms/:roomId/deactivate` - 채팅방 비활성화 (삭제)

### 메시지

- `POST /api/messages` - 새 메시지 전송
- `GET /api/messages/chat-room/:chatRoomId` - 채팅방의 메시지 목록 조회
- `GET /api/messages/:messageId` - 특정 메시지 조회

### 크레딧 로그

- `POST /api/credits` - 일반 크레딧 로그 생성 (일반적으로 내부용)
- `GET /api/credits/user/:userId` - 사용자의 크레딧 로그 조회
- `GET /api/credits/:logId` - 특정 크레딧 로그 조회
- `POST /api/credits/charge` - 크레딧 충전
- `POST /api/credits/use/match` - 매칭에 크레딧 사용
- `POST /api/credits/use/profile-unlock` - 프로필 잠금해제에 크레딧 사용

### 관리자

- `POST /api/admin/register` - 관리자 계정 생성
- `POST /api/admin/login` - 관리자 로그인
- `GET /api/admin` - 모든 관리자 조회 (관리자 권한 필요)
- `GET /api/admin/:id` - 특정 관리자 조회 (관리자 권한 필요)
- `PUT /api/admin/:id/change-password` - 관리자 비밀번호 변경 (관리자 권한 필요)
- `DELETE /api/admin/:id` - 관리자 삭제 (관리자 권한 필요)

## 데이터 모델

### 사용자 (User)

| 필드명 | 타입 | 설명 |
|:---|:---|:---|
| id | UUID (PK) | 유저 고유 ID |
| email | string | 이메일 (소셜 로그인은 optional) |
| passwordHash | string | 비밀번호 해시 |
| nickname | string | 닉네임 |
| birthYear | number | 태어난 연도 |
| height | number | 키 |
| city | string | 도시명 (프리텍스트) |
| gender | enum('male', 'female') | 성별 |
| profileImages | string[] | 프로필 이미지 3개 |
| businessCardImage | string | 명함 사진 (남자만) |
| credit | number | 크레딧 잔액 |
| socialProvider | enum('local', 'google', 'kakao') | 가입 방법 구분 |
| createdAt | datetime | 생성일 |
| updatedAt | datetime | 업데이트일 |

### 매칭 대기열 (MatchQueue)

| 필드명 | 타입 | 설명 |
|:---|:---|:---|
| id | UUID (PK) | 대기열 엔트리 고유 ID |
| userId | UUID (FK) | 유저 ID |
| gender | enum('male', 'female') | 성별 |
| isWaiting | boolean | 대기 상태 여부 |
| createdAt | datetime | 생성 시간 |

### 채팅방 (ChatRoom)

| 필드명 | 타입 | 설명 |
|:---|:---|:---|
| id | UUID (PK) | 채팅방 고유 ID |
| user1Id | UUID (FK) | 첫번째 유저 ID |
| user2Id | UUID (FK) | 두번째 유저 ID |
| isActive | boolean | 채팅방 활성 상태 |
| createdAt | datetime | 생성일 |
| updatedAt | datetime | 수정일 |

### 메시지 (Message)

| 필드명 | 타입 | 설명 |
|:---|:---|:---|
| id | UUID (PK) | 메시지 고유 ID |
| chatRoomId | UUID (FK) | 채팅방 ID |
| senderId | UUID (FK) | 보낸 사람 ID |
| message | string | 텍스트 메시지 내용 |
| createdAt | datetime | 전송 시간 |

### 크레딧 로그 (CreditLog)

| 필드명 | 타입 | 설명 |
|:---|:---|:---|
| id | UUID (PK) | 로그 고유 ID |
| userId | UUID (FK) | 유저 ID |
| action | enum('match', 'profileUnlock', 'charge') | 크레딧 사용/충전 구분 |
| amount | number | 사용/충전한 크레딧 수량 (음수/양수) |
| createdAt | datetime | 작업 시간 |

### 관리자 (Admin)

| 필드명 | 타입 | 설명 |
|:---|:---|:---|
| id | UUID (PK) | 관리자 고유 ID |
| email | string | 관리자 이메일 |
| passwordHash | string | 비밀번호 해시 |
| role | enum('admin') | 역할 관리 | 