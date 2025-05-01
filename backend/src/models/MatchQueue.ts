import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Gender } from './User';

export interface IMatchQueue extends Document {
  _id: string;
  userId: string;
  gender: Gender;
  isWaiting: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MatchQueueSchema: Schema = new Schema(
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
    gender: {
      type: String,
      enum: Object.values(Gender),
      required: true
    },
    isWaiting: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// 사용자당 하나의 활성 대기열만 허용하는 복합 인덱스
MatchQueueSchema.index({ userId: 1, isWaiting: 1 }, { unique: true, partialFilterExpression: { isWaiting: true } });

export default mongoose.model<IMatchQueue>('MatchQueue', MatchQueueSchema); 