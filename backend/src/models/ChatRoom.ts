import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface IChatRoom extends Document {
  _id: string;
  user1Id: string;
  user2Id: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ChatRoomSchema: Schema = new Schema(
  {
    _id: {
      type: String,
      default: uuidv4
    },
    user1Id: {
      type: String,
      required: true,
      ref: 'User'
    },
    user2Id: {
      type: String,
      required: true,
      ref: 'User'
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// 두 사용자 간에 활성화된 채팅방이 하나만 있도록 복합 인덱스 설정
ChatRoomSchema.index(
  { 
    user1Id: 1, 
    user2Id: 1, 
    isActive: 1 
  }, 
  { 
    unique: true, 
    partialFilterExpression: { isActive: true } 
  }
);

// 사용자가 참여한 모든 채팅방을 빠르게 조회할 수 있도록 인덱스 설정
ChatRoomSchema.index({ user1Id: 1, isActive: 1 });
ChatRoomSchema.index({ user2Id: 1, isActive: 1 });

export default mongoose.model<IChatRoom>('ChatRoom', ChatRoomSchema); 