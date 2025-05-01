export interface SignupData {
    email: string;
    gender: 'male' | 'female' | '';
    password: string;
    passwordConfirm: string;
    nickname: string;
    dob: string;
    height: string;
    city: string;
    profilePics: (File | null)[]; // Central definition
    businessCard?: File | null;
}

// Add other shared interfaces or types here if needed 