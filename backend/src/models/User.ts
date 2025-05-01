import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';

export enum Gender {
  MALE = 'male',
  FEMALE = 'female'
}

export enum SocialProvider {
  LOCAL = 'local',
  GOOGLE = 'google',
  KAKAO = 'kakao'
}

export interface IUser extends Document {
  _id: string;
  email?: string;
  passwordHash?: string;
  nickname: string;
  birthYear: number;
  height: number;
  city: string;
  gender: Gender;
  profileImages: string[];
  businessCardImage?: string;
  credit: number;
  socialProvider: SocialProvider;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema: Schema = new Schema(
  {
    _id: {
      type: String,
      default: uuidv4
    },
    email: {
      type: String,
      sparse: true,
      trim: true,
      lowercase: true,
      index: true
    },
    passwordHash: {
      type: String
    },
    nickname: {
      type: String,
      required: true,
      trim: true
    },
    birthYear: {
      type: Number,
      required: true
    },
    height: {
      type: Number,
      required: true
    },
    city: {
      type: String,
      required: true,
      trim: true
    },
    gender: {
      type: String,
      enum: Object.values(Gender),
      required: true
    },
    profileImages: {
      type: [String],
      required: true,
      validate: {
        validator: function(v: string[]) {
          return v.length <= 3;
        },
        message: '프로필 이미지는 최대 3개까지 허용됩니다.'
      }
    },
    businessCardImage: {
      type: String,
      validate: {
        validator: function(this: IUser, v: string) {
          return this.gender !== Gender.FEMALE || !v;
        },
        message: '명함 사진은 남성 사용자만 업로드할 수 있습니다.'
      }
    },
    credit: {
      type: Number,
      default: 0
    },
    socialProvider: {
      type: String,
      enum: Object.values(SocialProvider),
      required: true
    }
  },
  {
    timestamps: true
  }
);

// 비밀번호 비교 메서드
UserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  if (!this.passwordHash) return false;
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// 비밀번호 해싱 미들웨어
UserSchema.pre('save', async function(next) {
  if (this.isModified('passwordHash') && this.passwordHash) {
    const salt = await bcrypt.genSalt(10);
    this.passwordHash = await bcrypt.hash(this.passwordHash as string, salt);
  }
  next();
});

export default mongoose.model<IUser>('User', UserSchema); 