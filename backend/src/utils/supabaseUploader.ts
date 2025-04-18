import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

// 환경 변수 로드
dotenv.config();
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// 캐싱된 Supabase 클라이언트 관리
class SupabaseClientManager {
    private static instance: SupabaseClientManager;
    private client: SupabaseClient | null = null;
    private lastCreatedAt: number = 0;
    private readonly tokenExpiryTime = 55 * 60 * 1000; // 55분 (토큰이 1시간이니 여유있게 55분으로 설정)

    private constructor() {}

    public static getInstance(): SupabaseClientManager {
        if (!SupabaseClientManager.instance) {
            SupabaseClientManager.instance = new SupabaseClientManager();
        }
        return SupabaseClientManager.instance;
    }

    public getClient(): SupabaseClient {
        const now = Date.now();
        
        // 클라이언트가 없거나 토큰이 만료되었을 경우 새로 생성
        if (!this.client || now - this.lastCreatedAt > this.tokenExpiryTime) {
            console.log('[Supabase Client] 새로운 클라이언트 생성 또는 갱신');
            this.client = createClient(
                SUPABASE_URL || '',
                SUPABASE_SERVICE_KEY || '',
                {
                    auth: {
                        persistSession: false,
                        autoRefreshToken: true
                    }
                }
            );
            this.lastCreatedAt = now;
            console.log('[Supabase Client] 클라이언트 생성 완료, 시간:', new Date(now).toISOString());
        } else {
            console.log('[Supabase Client] 캐싱된 클라이언트 사용, 생성 후 경과 시간:', Math.round((now - this.lastCreatedAt) / 1000), '초');
        }
        
        return this.client;
    }
}

// Supabase 클라이언트 가져오기 (싱글톤 패턴)
const getSupabaseClient = (): SupabaseClient => {
    return SupabaseClientManager.getInstance().getClient();
};

// Supabase 파일 삭제
export const deleteSupabaseFile = async (filePath: string): Promise<void> => {
    if (!filePath) return;
    // Extract the path after the bucket name from the public URL
    const urlParts = filePath.split('/profile-images/');
    if (urlParts.length < 2) {
        console.warn(`[Supabase Delete] Could not parse file path from URL: ${filePath}`);
        return;
    }
    const supabasePath = urlParts[1];
    console.log(`[Supabase Delete] Deleting old file: ${supabasePath}`);
    
    try {
        const supabase = getSupabaseClient();
        const { error: deleteError } = await supabase.storage
            .from('profile-images')
            .remove([supabasePath]);
        
        if (deleteError) {
            console.error(`[Supabase Delete] Error deleting file ${supabasePath}:`, deleteError);
            // Log error but continue, don't block the update
        }
    } catch (e) {
        console.error(`[Supabase Delete] Exception deleting file ${supabasePath}:`, e);
    }
};

// Supabase에 프로필 이미지 업로드
export const uploadProfileImage = async (
    file: Express.Multer.File,
    userId: number,
    fileName?: string
): Promise<string> => {
    const supabase = getSupabaseClient();
    const profileImageFolder = `profiles/${userId}`;
    const finalFileName = fileName || `${uuidv4()}-${file.originalname}`;
    const filePath = `${profileImageFolder}/${finalFileName}`;
    
    console.log(`[Supabase Upload] Uploading profile picture: ${filePath}`);
    console.log(`[Supabase Upload Debug] 업로드 시작 - 버퍼 크기: ${file.buffer.length} 바이트, MIME 타입: ${file.mimetype}`);
    
    try {
        const { data: uploadResult, error: uploadError } = await supabase.storage
            .from('profile-images')
            .upload(filePath, file.buffer, { contentType: file.mimetype, upsert: false });
        
        console.log(`[Supabase Upload Debug] 업로드 응답 - 성공: ${!uploadError}, 데이터: ${JSON.stringify(uploadResult || {})}`);
        
        if (uploadError) {
            console.error(`[Supabase Upload Error] 세부정보:`, { 
                message: uploadError.message,
                name: uploadError.name
            });
            throw new Error(`Failed to upload profile picture: ${uploadError.message}`);
        }
        
        console.log(`[Supabase URL] Public URL 요청 시작 - 경로: ${filePath}`);
        const { data: urlData } = supabase.storage.from('profile-images').getPublicUrl(filePath);
        console.log(`[Supabase URL] Public URL 응답 - 성공: true, URL: ${urlData?.publicUrl || '없음'}`);
        
        if (!urlData || !urlData.publicUrl) {
            console.error(`[Supabase URL Error] Public URL을 가져올 수 없음:`, '알 수 없는 오류');
            throw new Error(`Failed to get public URL for profile picture.`);
        }
        
        return urlData.publicUrl;
    } catch (e: any) {
        console.error(`[Supabase Exception] 업로드 중 예외 발생:`, e.message, e.stack);
        throw e;
    }
};

// Supabase에 명함 이미지 업로드
export const uploadBusinessCard = async (
    file: Express.Multer.File,
    userId: number
): Promise<string> => {
    const supabase = getSupabaseClient();
    const businessCardFolder = `business_cards/${userId}`;
    const fileName = `${uuidv4()}-${file.originalname}`;
    const filePath = `${businessCardFolder}/${fileName}`;
    
    console.log(`[Supabase Upload] Uploading business card: ${filePath}`);
    
    try {
        const { error: uploadError } = await supabase.storage
            .from('profile-images')
            .upload(filePath, file.buffer, { contentType: file.mimetype, upsert: false });
            
        if (uploadError) {
            throw new Error(`Failed to upload business card: ${uploadError.message}`);
        }
        
        const { data: urlData } = supabase.storage.from('profile-images').getPublicUrl(filePath);
        
        if (!urlData || !urlData.publicUrl) {
            throw new Error(`Failed to get public URL for business card.`);
        }
        
        return urlData.publicUrl;
    } catch (e: any) {
        console.error(`[Supabase Exception] 업로드 중 예외 발생:`, e.message, e.stack);
        throw e;
    }
}; 