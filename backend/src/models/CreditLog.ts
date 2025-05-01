import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export enum CreditAction {
  MATCH = 'match',            // 매칭 사용
  PROFILE_UNLOCK = 'profileUnlock', // 프로필 잠금해제
  CHARGE = 'charge'           // 크레딧 충전
}

export interface ICreditLog extends Document {
  _id: string;
  userId: string;
  action: CreditAction;
  amount: number;
  createdAt: Date;
}

const CreditLogSchema: Schema = new Schema(
  {
    _id: {
      type: String,
      default: uuidv4
    },
    userId: {
      type: String,
      required: true,
      ref: 'User'
    },
    action: {
      type: String,
      enum: Object.values(CreditAction),
      required: true
    },
    amount: {
      type: Number,
      required: true
    }
  },
  {
    timestamps: true
  }
);

// 사용자별 크레딧 로그 조회를 위한 인덱스
CreditLogSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model<ICreditLog>('CreditLog', CreditLogSchema); 