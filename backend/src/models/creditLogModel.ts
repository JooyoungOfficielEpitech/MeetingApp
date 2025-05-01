import mongoose, { Document, Schema } from 'mongoose';
import { IUser } from './userModel';

export interface ICreditLog extends Document {
  user: IUser['_id'];
  amount: number;
  type: 'charge' | 'use';
  service?: string;
  description: string;
  createdAt: Date;
}

const creditLogSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    enum: ['charge', 'use'],
    required: true
  },
  service: {
    type: String,
    required: function(this: ICreditLog) {
      return this.type === 'use';
    }
  },
  description: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

export const CreditLog = mongoose.model<ICreditLog>('CreditLog', creditLogSchema); 