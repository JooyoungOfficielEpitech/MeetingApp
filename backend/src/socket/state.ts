import { Socket } from 'socket.io';

// Gender 타입 정의
export type Gender = 'male' | 'female' | 'other'; 

export interface ConnectedUser {
    userId: number;
    socketId: string;
    gender: Gender | null; 
    isOccupied: boolean; // Track if the user is currently in an active match
}

// Map stores all connected users
export const connectedUsers = new Map<string, ConnectedUser>();
// Array stores only FEMALE users actively waiting for a match
export const waitingUsers: ConnectedUser[] = []; 