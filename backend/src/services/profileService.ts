import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/jwt';
import { deleteSupabaseFile, uploadProfileImage, uploadBusinessCard } from '../utils/supabaseUploader';

const db = require('../../models');
const User = db.User;

/**
 * 사용자 프로필 사진을 업로드하고 URL 배열을 반환합니다.
 * @param userId 사용자 ID
 * @param files 업로드된 프로필 이미지 파일 배열
 * @param existingUrls 기존 이미지 URL 배열 (유지 모드에서 사용)
 * @param keepExisting 기존 이미지를 유지할지 여부
 * @returns 업로드된 이미지 URL 배열
 */
export const processProfileImages = async (
    userId: number,
    files: Express.Multer.File[],
    existingUrls: string[] = [],
    keepExisting: boolean = true
): Promise<string[]> => {
    console.log(`[Supabase Upload] Processing profile pictures for user ${userId}...`);
    
    let uploadedUrls: string[] = [];
    
    // 기존 이미지 처리
    if (!keepExisting && existingUrls && Array.isArray(existingUrls)) {
        // 기존 이미지 삭제 모드
        for (const url of existingUrls) {
            await deleteSupabaseFile(url);
        }
        // 새 이미지만 사용
        uploadedUrls = [];
    } else if (Array.isArray(existingUrls)) {
        // 기존 이미지 유지 모드
        uploadedUrls = [...existingUrls];
    }
    
    // 새 이미지 업로드
    for (const file of files) {
        try {
            const imageUrl = await uploadProfileImage(file, userId);
            uploadedUrls.push(imageUrl);
            console.log(`[Supabase Upload] New profile picture uploaded: ${imageUrl}`);
        } catch (e: any) {
            console.error(`[Supabase Exception] 프로필 이미지 업로드 중 예외 발생:`, e.message);
            throw e;
        }
    }
    
    return uploadedUrls;
};

/**
 * 사용자 명함 이미지를 업로드하고 URL을 반환합니다.
 * @param userId 사용자 ID
 * @param file 업로드된 명함 이미지 파일
 * @param existingUrl 기존 명함 이미지 URL
 * @returns 업로드된 명함 이미지 URL
 */
export const processBusinessCard = async (
    userId: number,
    file: Express.Multer.File,
    existingUrl: string | null
): Promise<string> => {
    console.log(`[Supabase Upload] Processing business card for user ${userId}...`);
    
    // 기존 명함 이미지 삭제
    if (existingUrl) {
        await deleteSupabaseFile(existingUrl);
    }
    
    // 새 명함 업로드
    try {
        const cardUrl = await uploadBusinessCard(file, userId);
        console.log(`[Supabase Upload] New business card uploaded: ${cardUrl}`);
        return cardUrl;
    } catch (e: any) {
        console.error(`[Supabase Exception] 명함 이미지 업로드 중 예외 발생:`, e.message);
        throw e;
    }
};

/**
 * 프로필 업데이트를 위한 객체를 준비합니다.
 * @param data 입력 데이터
 * @returns 업데이트 객체
 */
export const prepareProfileUpdates = (data: {
    nickname?: string;
    age?: string | number;
    height?: string | number;
    mbti?: string;
    gender?: string;
    city?: string;
    profileImageUrls?: string[];
    businessCardImageUrl?: string | null;
}) => {
    const updates: any = {};
    
    if (data.nickname !== undefined) updates.nickname = data.nickname;
    if (data.age !== undefined) updates.age = parseInt(String(data.age));
    if (data.height !== undefined) updates.height = parseInt(String(data.height));
    if (data.mbti !== undefined) updates.mbti = data.mbti.toUpperCase();
    if (data.gender !== undefined) updates.gender = data.gender.toLowerCase();
    if (data.city !== undefined) updates.city = data.city.toLowerCase();
    if (data.profileImageUrls) updates.profileImageUrls = data.profileImageUrls;
    if (data.businessCardImageUrl !== undefined) updates.businessCardImageUrl = data.businessCardImageUrl;
    
    // 항상 status를 pending_approval로 설정하고 거부 이유 제거
    updates.status = 'pending_approval';
    updates.rejectionReason = null;
    
    return updates;
};

/**
 * 프로필 업데이트 후 새 토큰을 생성합니다.
 * @param user 사용자 객체
 * @param updatedFields 업데이트된 필드 (선택사항)
 * @returns 새 JWT 토큰
 */
export const generateTokenAfterProfileUpdate = (
    user: any,
    updatedFields: any = {}
): string => {
    const payload = {
        userId: user.id,
        email: user.email,
        status: 'pending_approval',
        gender: updatedFields.gender || user.gender
    };
    
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
};

/**
 * 업데이트된 사용자 응답 객체를 준비합니다.
 * @param user 원본 사용자 객체
 * @param updates 업데이트된 필드
 * @returns 응답용 사용자 객체
 */
export const prepareUserResponse = (user: any, updates: any = {}) => {
    const updatedUserData = { ...user.toJSON(), ...updates };
    
    return {
        id: updatedUserData.id,
        email: updatedUserData.email,
        name: updatedUserData.name,
        nickname: updatedUserData.nickname,
        gender: updatedUserData.gender,
        age: updatedUserData.age,
        height: updatedUserData.height,
        mbti: updatedUserData.mbti,
        profileImageUrls: updatedUserData.profileImageUrls,
        businessCardImageUrl: updatedUserData.businessCardImageUrl,
        status: updatedUserData.status,
        city: updatedUserData.city
    };
}; 