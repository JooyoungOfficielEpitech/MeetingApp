import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface IMessage extends Document {
  _id: string;
  chatRoomId: string;
  senderId: string;
  message: string;
  createdAt: Date;
}

const MessageSchema: Schema = new Schema(
  {
    _id: {
      type: String,
      default: uuidv4
    },
    chatRoomId: {
      type: String,
      required: true,
      ref: 'ChatRoom'
    },
    senderId: {
      type: String,
      required: true,
      ref: 'User'
    },
    message: {
      type: String,
      required: true,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

// 특정 채팅방의 메시지를 빠르게 검색하기 위한 인덱스
MessageSchema.index({ chatRoomId: 1, createdAt: 1 });

export default mongoose.model<IMessage>('Message', MessageSchema); 