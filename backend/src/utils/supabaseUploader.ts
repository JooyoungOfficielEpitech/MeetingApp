import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

// 환경 변수 로드
dotenv.config();
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// 초기 진단 로깅
console.log('[Supabase Debug] URL 첫 글자:', SUPABASE_URL?.substring(0, 8));
console.log('[Supabase Debug] 키 길이:', SUPABASE_SERVICE_KEY?.length);
console.log('[Supabase Debug] 키 첫 10자:', SUPABASE_SERVICE_KEY?.substring(0, 10));

// Supabase 진단 테스트
const testSupabaseAccess = async (): Promise<void> => {
    try {
        console.log('[Supabase Test] 스토리지 접근 테스트 시작...');
        const response = await fetch(`${SUPABASE_URL}/storage/v1/bucket/profile-images`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Content-Type': 'application/json',
                'apikey': SUPABASE_SERVICE_KEY || ''
            }
        });
        
        console.log('[Supabase Test] 응답 상태:', response.status);
        console.log('[Supabase Test] 응답 헤더:', JSON.stringify([...response.headers.entries()]));
        
        if (response.ok) {
            const data = await response.json();
            console.log('[Supabase Test] 테스트 성공:', JSON.stringify(data));
        } else {
            const errorText = await response.text();
            console.error('[Supabase Test] 테스트 실패:', errorText);
        }
    } catch (error) {
        console.error('[Supabase Test] 예외 발생:', error);
    }
};

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

    public async getClient(): Promise<SupabaseClient> {
        const now = Date.now();
        
        // 클라이언트가 없거나 토큰이 만료되었을 경우 새로 생성
        if (!this.client || now - this.lastCreatedAt > this.tokenExpiryTime) {
            console.log('[Supabase Client] 새로운 클라이언트 생성 또는 갱신');
            
            // 생성 전 접근 테스트
            await testSupabaseAccess();
            
            this.client = createClient(
                SUPABASE_URL || '',
                SUPABASE_SERVICE_KEY || '',
                {
                    auth: {
                        persistSession: false,
                        autoRefreshToken: false,
                        detectSessionInUrl: false
                    },
                    global: {
                        headers: {
                            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                            'apikey': SUPABASE_SERVICE_KEY || ''
                        }
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
const getSupabaseClient = async (): Promise<SupabaseClient> => {
    return await SupabaseClientManager.getInstance().getClient();
};

// HTTP를 통한 직접 파일 업로드 구현
const uploadFileDirectly = async (
    bucketName: string,
    filePath: string,
    fileBuffer: Buffer,
    contentType: string
): Promise<string> => {
    console.log(`[Direct Upload] 직접 HTTP를 통한 업로드 시작: ${filePath}`);
    console.log(`[Direct Upload] 버퍼 크기: ${fileBuffer.length} 바이트, MIME 타입: ${contentType}`);
    
    try {
        // 1. 업로드 URL 획득
        const uploadResponse = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucketName}/${filePath}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Content-Type': 'application/json',
                'apikey': SUPABASE_SERVICE_KEY || ''
            },
            body: JSON.stringify({
                contentType: contentType,
                size: fileBuffer.length
            })
        });
        
        if (!uploadResponse.ok) {
            console.error('[Direct Upload] 업로드 URL 획득 실패:', await uploadResponse.text());
            throw new Error('Failed to get upload URL');
        }
        
        // 2. 파일 업로드
        const uploadUrl = (await uploadResponse.json()).url;
        console.log(`[Direct Upload] 업로드 URL 획득 성공: ${uploadUrl}`);
        
        const fileUploadResponse = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': contentType
            },
            body: fileBuffer
        });
        
        if (!fileUploadResponse.ok) {
            console.error('[Direct Upload] 파일 업로드 실패:', await fileUploadResponse.text());
            throw new Error('Failed to upload file');
        }
        
        console.log('[Direct Upload] 파일 업로드 성공');
        
        // 3. 공개 URL 획득
        const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucketName}/${filePath}`;
        console.log(`[Direct Upload] 생성된 공개 URL: ${publicUrl}`);
        
        return publicUrl;
    } catch (error) {
        console.error('[Direct Upload] 업로드 중 오류 발생:', error);
        throw error;
    }
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
        const supabase = await getSupabaseClient();
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
    const profileImageFolder = `profiles/${userId}`;
    const finalFileName = fileName || `${uuidv4()}-${file.originalname}`;
    const filePath = `${profileImageFolder}/${finalFileName}`;
    
    console.log(`[Supabase Upload] Uploading profile picture: ${filePath}`);
    console.log(`[Supabase Upload Debug] 업로드 시작 - 버퍼 크기: ${file.buffer.length} 바이트, MIME 타입: ${file.mimetype}`);
    
    try {
        // 먼저 Supabase API로 시도
        try {
            const supabase = await getSupabaseClient();
            const { data: uploadResult, error: uploadError } = await supabase.storage
                .from('profile-images')
                .upload(filePath, file.buffer, { contentType: file.mimetype, upsert: false });
            
            console.log(`[Supabase Upload Debug] 업로드 응답 - 성공: ${!uploadError}, 데이터: ${JSON.stringify(uploadResult || {})}`);
            
            if (uploadError) {
                throw uploadError;
            }
            
            console.log(`[Supabase URL] Public URL 요청 시작 - 경로: ${filePath}`);
            const { data: urlData } = supabase.storage.from('profile-images').getPublicUrl(filePath);
            
            if (!urlData || !urlData.publicUrl) {
                throw new Error('Failed to get public URL');
            }
            
            console.log(`[Supabase Upload] 업로드 성공: ${urlData.publicUrl}`);
            return urlData.publicUrl;
        } catch (supabaseError) {
            // Supabase API 실패 시 직접 HTTP 요청으로 시도
            console.warn(`[Supabase Upload] API 업로드 실패, 직접 HTTP 요청으로 시도: ${supabaseError}`);
            const publicUrl = await uploadFileDirectly('profile-images', filePath, file.buffer, file.mimetype);
            return publicUrl;
        }
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
    const businessCardFolder = `business_cards/${userId}`;
    const fileName = `${uuidv4()}-${file.originalname}`;
    const filePath = `${businessCardFolder}/${fileName}`;
    
    console.log(`[Supabase Upload] Uploading business card: ${filePath}`);
    
    try {
        // 먼저 Supabase API로 시도
        try {
            const supabase = await getSupabaseClient();
            const { data: uploadResult, error: uploadError } = await supabase.storage
                .from('profile-images')
                .upload(filePath, file.buffer, { contentType: file.mimetype, upsert: false });
                
            if (uploadError) {
                throw uploadError;
            }
            
            const { data: urlData } = supabase.storage.from('profile-images').getPublicUrl(filePath);
            
            if (!urlData || !urlData.publicUrl) {
                throw new Error('Failed to get public URL');
            }
            
            return urlData.publicUrl;
        } catch (supabaseError) {
            // Supabase API 실패 시 직접 HTTP 요청으로 시도
            console.warn(`[Supabase Upload] API 업로드 실패, 직접 HTTP 요청으로 시도: ${supabaseError}`);
            const publicUrl = await uploadFileDirectly('profile-images', filePath, file.buffer, file.mimetype);
            return publicUrl;
        }
    } catch (e: any) {
        console.error(`[Supabase Exception] 업로드 중 예외 발생:`, e.message, e.stack);
        throw e;
    }
}; 