import 'express-serve-static-core'; // Module augmentation에 필요

// req.user에 기대하는 구조 정의
interface AppUser {
  userId: number;
  email: string;
  status?: string;
  // JWT 페이로드 또는 사용자 모델에서 필요한 다른 속성 추가 가능
  [key: string]: any; // 다른 잠재적 속성 허용
}

declare global {
  namespace Express {
    // Passport/Express 세션에서 사용되는 User 인터페이스 증강
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    export interface User extends AppUser {} // Express.User가 AppUser 구조를 따르도록 함
    
    // Response 타입도 증강하여 라우트 핸들러에서 반환 타입 문제 해결
    interface Response {
      json: (body?: any) => any;
      send: (body?: any) => any;
      status: (code: number) => any;
    }
  }
}

// ES 모듈을 사용하고 모듈로 만들기 위해 무언가를 내보내야 하는 경우 (선택 사항)
export {}; 