import { Request, Response } from 'express';
import Admin, { IAdmin, AdminRole } from '../models/Admin';
import jwt from 'jsonwebtoken';

// JWT 토큰 생성 헬퍼 함수
const generateToken = (id: string, email: string, role: string) => {
  return jwt.sign(
    { id, email, role },
    process.env.JWT_SECRET || 'admin-secret-key',
    { expiresIn: '1d' }
  );
};

// 관리자 계정 생성
export const createAdmin = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // 유효성 검사
    if (!email || !password) {
      return res.status(400).json({ message: '이메일과 비밀번호는 필수 항목입니다.' });
    }

    // 이메일 중복 확인
    const adminExists = await Admin.findOne({ email });
    if (adminExists) {
      return res.status(400).json({ message: '이미 등록된 이메일입니다.' });
    }

    // 새 관리자 생성
    const admin = new Admin({
      email,
      passwordHash: password, // 저장 시 pre 훅에서 해싱됨
      role: AdminRole.ADMIN
    });

    const savedAdmin = await admin.save();

    // 비밀번호 해시 제외하고 응답
    res.status(201).json({
      message: '관리자 계정이 생성되었습니다.',
      admin: {
        _id: savedAdmin._id,
        email: savedAdmin.email,
        role: savedAdmin.role
      }
    });
  } catch (error) {
    console.error('관리자 생성 에러:', error);
    res.status(500).json({ message: '관리자 계정 생성 중 오류가 발생했습니다.' });
  }
};

// 관리자 로그인
export const loginAdmin = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // 유효성 검사
    if (!email || !password) {
      return res.status(400).json({ message: '이메일과 비밀번호는 필수 항목입니다.' });
    }

    // 관리자 존재 확인
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({ message: '이메일 또는 비밀번호가 일치하지 않습니다.' });
    }

    // 비밀번호 확인
    const isPasswordMatch = await admin.comparePassword(password);
    if (!isPasswordMatch) {
      return res.status(401).json({ message: '이메일 또는 비밀번호가 일치하지 않습니다.' });
    }

    // JWT 토큰 생성
    const token = generateToken(admin._id, admin.email, admin.role);

    res.json({
      message: '로그인 성공',
      token,
      admin: {
        _id: admin._id,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (error) {
    console.error('관리자 로그인 에러:', error);
    res.status(500).json({ message: '로그인 중 오류가 발생했습니다.' });
  }
};

// 모든 관리자 조회 (슈퍼 관리자용)
export const getAllAdmins = async (_req: Request, res: Response) => {
  try {
    const admins = await Admin.find().select('-passwordHash');
    res.json(admins);
  } catch (error) {
    console.error('관리자 목록 조회 에러:', error);
    res.status(500).json({ message: '관리자 목록 조회 중 오류가 발생했습니다.' });
  }
};

// 특정 관리자 조회
export const getAdminById = async (req: Request, res: Response) => {
  try {
    const admin = await Admin.findById(req.params.id).select('-passwordHash');
    
    if (!admin) {
      return res.status(404).json({ message: '관리자를 찾을 수 없습니다.' });
    }

    res.json(admin);
  } catch (error) {
    console.error('관리자 조회 에러:', error);
    res.status(500).json({ message: '관리자 조회 중 오류가 발생했습니다.' });
  }
};

// 관리자 비밀번호 변경
export const changePassword = async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const adminId = req.params.id;

    // 유효성 검사
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: '현재 비밀번호와 새 비밀번호는 필수 항목입니다.' });
    }

    // 관리자 존재 확인
    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({ message: '관리자를 찾을 수 없습니다.' });
    }

    // 현재 비밀번호 확인
    const isPasswordMatch = await admin.comparePassword(currentPassword);
    if (!isPasswordMatch) {
      return res.status(401).json({ message: '현재 비밀번호가 일치하지 않습니다.' });
    }

    // 비밀번호 업데이트
    admin.passwordHash = newPassword;
    await admin.save();

    res.json({ message: '비밀번호가 성공적으로 변경되었습니다.' });
  } catch (error) {
    console.error('비밀번호 변경 에러:', error);
    res.status(500).json({ message: '비밀번호 변경 중 오류가 발생했습니다.' });
  }
};

// 관리자 삭제
export const deleteAdmin = async (req: Request, res: Response) => {
  try {
    const admin = await Admin.findById(req.params.id);
    
    if (!admin) {
      return res.status(404).json({ message: '관리자를 찾을 수 없습니다.' });
    }

    await admin.deleteOne();
    
    res.json({ message: '관리자가 삭제되었습니다.' });
  } catch (error) {
    console.error('관리자 삭제 에러:', error);
    res.status(500).json({ message: '관리자 삭제 중 오류가 발생했습니다.' });
  }
}; 