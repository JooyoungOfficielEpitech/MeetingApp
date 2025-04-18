// 프로필 유효성 검사 유틸리티

/**
 * 프로필 업데이트 시 필요한 유효성 검사를 수행합니다.
 * @param body 요청 본문
 * @param files 업로드된 파일들
 * @param isFirstCompletion 첫 프로필 완성인지 여부
 * @returns 오류 배열 (비어있으면 유효함)
 */
export const validateProfileUpdate = (
    body: {
        nickname?: string;
        age?: string | number;
        height?: string | number;
        mbti?: string;
        gender?: string;
        city?: string;
    },
    files?: {
        profilePictures?: Express.Multer.File[];
        businessCard?: Express.Multer.File[];
    },
    isFirstCompletion: boolean = false
): string[] => {
    const { nickname, age, height, mbti, gender, city } = body;
    const errors: string[] = [];
    
    // 필수 필드 검증 (첫 프로필 완성 시)
    if (isFirstCompletion) {
        if (!nickname || nickname.trim() === '') errors.push('Nickname is required.');
        if (!age || isNaN(parseInt(String(age))) || parseInt(String(age)) < 19) errors.push('Valid age (19+) is required.');
        if (!height || isNaN(parseInt(String(height))) || parseInt(String(height)) < 100) errors.push('Valid height (>= 100cm) is required.');
        if (!mbti || !/^[EI][SN][TF][JP]$/i.test(mbti)) errors.push('Valid MBTI (4 letters) is required.');
        if (!gender || !['male', 'female'].includes(gender.toLowerCase())) errors.push('Valid gender (male/female) is required.');
        if (!city || !['seoul', 'busan', 'jeju'].includes(city.toLowerCase())) errors.push('Valid city (seoul/busan/jeju) is required.');
        if (!files?.profilePictures || files.profilePictures.length === 0) errors.push('At least one profile picture required.');
        if (!files?.businessCard || files.businessCard.length === 0) errors.push('Business card image required.');
    } else {
        // 업데이트 시 제공된 필드만 검증
        if (nickname !== undefined && nickname.trim() === '') errors.push('Nickname cannot be empty if provided.');
        if (age !== undefined && (isNaN(parseInt(String(age))) || parseInt(String(age)) < 19)) errors.push('Age must be a valid number (19+) if provided.');
        if (height !== undefined && (isNaN(parseInt(String(height))) || parseInt(String(height)) < 100)) errors.push('Height must be a valid number (>= 100cm) if provided.');
        if (mbti !== undefined && !/^[EI][SN][TF][JP]$/i.test(mbti)) errors.push('MBTI must be 4 valid letters if provided.');
        if (gender !== undefined && !['male', 'female'].includes(gender.toLowerCase())) errors.push('Gender must be male or female if provided.');
        if (city !== undefined && !['seoul', 'busan', 'jeju'].includes(city.toLowerCase())) errors.push('City must be seoul, busan, or jeju if provided.');
    }
    
    // 공통 파일 유효성 검사
    if (files?.profilePictures && files.profilePictures.length > 3) {
        errors.push('Maximum 3 profile pictures allowed.');
    }
    if (files?.businessCard && files.businessCard.length > 1) {
        errors.push('Only one business card image allowed.');
    }
    
    return errors;
}; 