import { Socket, Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { connectedUsers, waitingUsers, ConnectedUser, Gender } from './state'; // 상태 관리 import
const db = require('../../models'); // Correct path from src/socket/ to models/
const User = db.User;
const Match = db.Match;
const Message = db.Message;
const MatchingWaitList = db.MatchingWaitList;
// import { io } from './index'; // Removed to prevent circular dependency

const JWT_SECRET = process.env.JWT_SECRET || 'YOUR_VERY_SECRET_KEY_CHANGE_ME';

// Define sendChatHistory helper function
const sendChatHistory = async (socket: Socket, matchIdToSendFor: string | null) => {
    if (!matchIdToSendFor) { return; }
    try {
        const history = await Message.findAll({ where: { matchId: matchIdToSendFor }, order: [['createdAt', 'ASC']], attributes: ['senderId', 'text', 'createdAt'] });
        const formattedHistory = history.map((msg: any) => ({ senderId: msg.senderId, text: msg.text, timestamp: msg.createdAt.getTime() }));
        socket.emit('chat-history', formattedHistory);
        console.log(`Sent chat history (${formattedHistory.length} messages) for match ${matchIdToSendFor} to socket ${socket.id}`);
    } catch (error) {
        console.error(`Error fetching/sending chat history for ${matchIdToSendFor} to socket ${socket.id}:`, error);
        socket.emit('error', '채팅 기록 로딩 오류');
    }
};

// Modified handleConnection to accept io instance
export const handleConnection = (socket: any, ioInstance: SocketIOServer) => {
    // Ensure user object exists from middleware before proceeding
    if (!socket.user || !socket.user.userId) {
        console.error("Connection handler: User info missing on socket. Disconnecting.");
        socket.disconnect(true);
        return;
    }

    const userId: number = socket.user.userId;
    const userGender: Gender | null = socket.user.gender;
    let isOccupied: boolean = socket.user.isOccupied; // Let, as it can change
    const initialMatchId: string | null = socket.user.initialMatchId; // Get from socket.user set by middleware
    let currentMatchId: string | null = null; // Track the current active match for THIS socket

    console.log(`User connected: ${userId} (Gender: ${userGender}, Initial Occupied: ${isOccupied}, Socket ID: ${socket.id}). InitialMatchId: ${initialMatchId || 'N/A'}`);

    // Update connectedUsers map
    const userInfo: ConnectedUser = { userId, socketId: socket.id, gender: userGender, isOccupied }; // Use initial isOccupied from DB
    connectedUsers.set(socket.id, userInfo);
    console.log('[Connection] Connected Users Map:', Array.from(connectedUsers.values()).map(u => `${u.userId}(${u.gender}, occ:${u.isOccupied})`));

    // --- Matching Logic (Triggered ONLY by Female Users) ---
    socket.on('start-matching', async () => {
        // Guard clauses: Check if female, not occupied, not already waiting
        if (userGender !== 'female') {
            console.warn(`User ${userId} (Gender: ${userGender}) tried to emit 'start-matching'. Ignoring.`);
            return;
        }
        // Re-check occupation status from the map for safety
        const currentUserState = connectedUsers.get(socket.id);
        if (currentUserState?.isOccupied) { // Check the map state
            console.warn(`User ${userId} is already occupied (map state). Cannot start matching.`);
            socket.emit('matching-error', '이미 매칭된 상태입니다.');
            return;
        }
        if (waitingUsers.some(u => u.userId === userId)) {
            console.log(`User ${userId} is already in the female waiting list.`);
            socket.emit('already-waiting');
            return;
        }

        console.log(`Female user ${userId} requested matching.`);

        // Find an available male user from the DATABASE WAITLIST
        let availableMaleEntry: any = null;
        try {
            availableMaleEntry = await MatchingWaitList.findOne({
                // order: [[ 'createdAt', 'ASC' ]] // Consider adding order
            });
        } catch (dbError: any) {
            console.error(`Error finding available male user in MatchingWaitList for user ${userId}:`, dbError);
            socket.emit('matching-error', '매칭 상대를 찾는 중 오류가 발생했습니다.');
            return;
        }

        if (availableMaleEntry) {
            const opponentUserId = availableMaleEntry.userId;
            console.log(`Match found for Female User ${userId} with Male User ${opponentUserId} from DB WaitList.`);
            const matchId = `match-${userId}-${opponentUserId}-${Date.now()}`;

            // Remove male from DB WaitList FIRST
            try {
                await MatchingWaitList.destroy({ where: { userId: opponentUserId } });
                console.log(`Removed Male ${opponentUserId} from MatchingWaitList.`);
            } catch (destroyError: any) {
                console.error(`Error removing male ${opponentUserId} from waitlist:`, destroyError);
                socket.emit('matching-error', '매칭 상대를 대기 목록에서 제거하는 중 오류 발생.');
                return; // Stop matching if we can't remove
            }

            // Find opponent's socket ID if they are currently connected
            let opponentSocketId: string | null = null;
            for (const [sid, connectedUser] of connectedUsers.entries()) {
                if (connectedUser.userId === opponentUserId) {
                    opponentSocketId = sid;
                    break;
                }
            }
            console.log(`Opponent ${opponentUserId} is ${opponentSocketId ? 'ONLINE' : 'OFFLINE'}.`);

            try {
                // DB Updates
                await Match.create({ matchId: matchId, user1Id: userId, user2Id: opponentUserId, isActive: true });
                console.log('New match record created in DB:', matchId);
                await User.update({ occupation: true }, { where: { id: userId } });
                await User.update({ occupation: true }, { where: { id: opponentUserId } });
                console.log(`Set DB occupation=true for users ${userId} and ${opponentUserId}`);

                // Update In-Memory State (connectedUsers map)
                const initiatorInfo = connectedUsers.get(socket.id);
                if (initiatorInfo) initiatorInfo.isOccupied = true;
                // isOccupied = true; // Update local variable? No, rely on map state primarily.
                if (opponentSocketId) {
                    const opponentInfo = connectedUsers.get(opponentSocketId);
                    if (opponentInfo) opponentInfo.isOccupied = true;
                    console.log(`Set Map isOccupied=true for users ${userId} and ONLINE opponent ${opponentUserId}.`);
                } else {
                    console.log(`Set Map isOccupied=true for user ${userId}. Opponent ${opponentUserId} is offline.`);
                }
                console.log('[DB WaitList Match Success] Connected Users Map:', Array.from(connectedUsers.values()).map(u => `${u.userId}(occ:${u.isOccupied})`));

            } catch (dbError: any) {
                console.error('Error during match creation or user status update (DB Find WaitList):', dbError);
                ioInstance.to(socket.id).emit('matching-error', '매치 생성 또는 상태 업데이트 중 오류 발생.');
                // IMPORTANT: Put male back in waitlist if subsequent DB updates fail
                MatchingWaitList.findOrCreate({ where: { userId: opponentUserId } })
                    .catch((err: any) => console.error("Failed to put male back in waitlist on error:", err));
                return;
            }

            // Notify Users & Join Room
            ioInstance.to(socket.id).emit('match-success', { matchId: matchId, opponentId: opponentUserId });
            socket.join(matchId);
            currentMatchId = matchId; // Set current match for this socket
            console.log(`User ${userId} joined room ${matchId}. Sent match-success.`);
            sendChatHistory(socket, currentMatchId); // Pass socket

            if (opponentSocketId) {
                const opponentSocket = ioInstance.sockets.sockets.get(opponentSocketId);
                if (opponentSocket) {
                    ioInstance.to(opponentSocketId).emit('match-success', { matchId: matchId, opponentId: userId });
                    opponentSocket.join(matchId);
                     // Find the opponent's handleConnection scope to set their currentMatchId?
                     // This is complex. It's better to inform the opponent's client
                     // and let the client handle joining the room, which will trigger
                     // the 'connection' logic again with the new matchId in auth.
                     // OR: emit a dedicated event like 'force-join' to the opponent.
                    console.log(`ONLINE Opponent User ${opponentUserId} joined room ${matchId}. Sent match-success.`);
                } else {
                    console.warn(`Opponent socket ${opponentSocketId} (User ${opponentUserId}) disappeared before joining room ${matchId}.`);
                }
            }

        } else {
            // No available male user found in WaitList, add the female user to the memory waiting list
            console.log(`No available male opponent found in DB WaitList, adding Female User ${userId} to memory waiting list.`);
            const currentUserInfo = connectedUsers.get(socket.id);
            if (currentUserInfo) {
                if (!waitingUsers.some((u) => u.userId === userId)) {
                    // Only add if not occupied (safety check)
                    if (!currentUserInfo.isOccupied) {
                        waitingUsers.push(currentUserInfo);
                    } else {
                        console.warn(`User ${userId} is occupied, cannot add to waiting list.`);
                        socket.emit('matching-error', '이미 매칭된 상태입니다.'); // Inform user
                    }
                } else {
                    console.log(`User ${userId} is already in the female waiting list.`);
                }
                console.log("Waiting List (Females waiting for Males):", waitingUsers.map(u => u.userId));
                socket.emit('waiting-for-match');
            } else {
                console.error(`Could not find user info for ${userId} in connectedUsers map before adding to memory waiting list.`);
                socket.emit('matching-error', '서버 오류: 사용자 정보를 찾을 수 없습니다.');
            }
        }
    });

    // --- Auto-join Room and Fetch History on Initial Connect ---
    if (initialMatchId) {
        const verifyAndJoin = async () => {
            try {
                const match = await Match.findOne({ where: { matchId: initialMatchId } });
                if (!match) {
                    console.warn(`User ${userId} attempted to join non-existent match: ${initialMatchId}`);
                    socket.emit('error', '만료되었거나 유효하지 않은 채팅방입니다.');
                } else if (!match.isActive) {
                    console.warn(`User ${userId} attempted to join an INACTIVE match: ${initialMatchId}`);
                    socket.emit('error', '상대방이 이미 채팅방을 나갔습니다.');
                    // Ensure local map state reflects inactivity
                    const userInfoInMap = connectedUsers.get(socket.id);
                    if (userInfoInMap) userInfoInMap.isOccupied = false;
                    // Avoid unnecessary DB update here if possible, rely on auth middleware initial state
                } else {
                    // Match is active, verify participation
                    if (match.user1Id !== userId && match.user2Id !== userId) {
                        console.warn(`User ${userId} tried to join match ${initialMatchId} they are not part of.`);
                        socket.emit('error', '이 채팅방의 참여자가 아닙니다.');
                        return;
                    }
                    // *** REMOVED: Do not automatically update DB occupation on join ***
                    // Occupation status should reflect the source of truth from auth/initial connection
                    // const userInfoInMap = connectedUsers.get(socket.id);
                    // if (userInfoInMap) userInfoInMap.isOccupied = true;
                    // await User.update({ occupation: true }, { where: { id: userId } });

                    // Ensure in-memory map reflects the (potentially already true) occupied state
                    // This relies on the auth middleware having set the correct initial state
                    const userInfoInMap = connectedUsers.get(socket.id);
                    if (userInfoInMap) {
                         if (!userInfoInMap.isOccupied) {
                              console.warn(`[verifyAndJoin] User ${userId} joined active match ${initialMatchId} but map state was not occupied. Updating map state only.`);
                              userInfoInMap.isOccupied = true; // Correct in-memory state if needed
                         }
                    } else {
                         console.error(`[verifyAndJoin] User info not found in map for user ${userId}`);
                    }

                    socket.join(initialMatchId);
                    currentMatchId = initialMatchId;
                    console.log(`User ${userId} auto-joined active Socket.IO room: ${currentMatchId}`);
                    sendChatHistory(socket, currentMatchId);
                }
            } catch (error) {
                console.error(`Error verifying match ${initialMatchId} for user ${userId}:`, error);
                socket.emit('error', '채팅방 상태 확인 중 오류 발생');
            }
        };
        verifyAndJoin();
    } else {
        console.warn(`User ${userId} connected without an initialMatchId in handshake.auth.`);
        const userInfoInMap = connectedUsers.get(socket.id);
        if (userInfoInMap && userInfoInMap.isOccupied) {
            // Wrap the async operation in an IIAFE
            (async () => {
                try {
                    console.warn(`User ${userId} connected without initial matchId but map state is occupied. Resetting.`);
                    userInfoInMap.isOccupied = false;
                    await User.update({ occupation: false }, { where: { id: userId } });
                    console.log(`[Connection] Synced occupation=false for user ${userId} connected without matchId.`);
                } catch (error) {
                    console.error(`[Connection] Error syncing occupation for user ${userId}:`, error);
                }
            })();
        }
    }
    // ---------------------------------------------------------

    // --- Handle Chat Messages ---
    socket.on('chat message', async (data: { matchId: string, text: string }) => {
        const { matchId: messageMatchId, text } = data;
        const senderUserId = userId; // Use userId from the connection scope

        // Validate against the server's tracked currentMatchId for this socket
        if (!currentMatchId || messageMatchId !== currentMatchId) {
            console.warn(`User ${senderUserId} msg rejected. MsgMatchId: ${messageMatchId}, Server's currentMatchId: ${currentMatchId}`);
            socket.emit('error', '메시지를 보낼 수 없는 방입니다.');
            return;
        }

        // Check if the sender is marked as occupied in the map
        const senderInfo = connectedUsers.get(socket.id);
        if (!senderInfo?.isOccupied) {
            console.warn(`User ${senderUserId} tried to send message to ${messageMatchId} but is not marked as occupied. Rejecting.`);
            socket.emit('error', '현재 매칭된 상태가 아닙니다.');
            return;
        }

        // Additional check: Ensure match is still active in DB before saving/sending
        try {
            const match = await Match.findOne({ where: { matchId: messageMatchId, isActive: true } });
            if (!match) {
                console.warn(`Match ${messageMatchId} is not active. Message from ${senderUserId} rejected.`);
                socket.emit('error', '비활성화된 채팅방에는 메시지를 보낼 수 없습니다.');
                // Update map state if inconsistent
                if (senderInfo) senderInfo.isOccupied = false;
                return;
            }

            const trimmedText = text.trim();
            if (!trimmedText || trimmedText.length === 0 || trimmedText.length > 500) {
                console.warn(`User ${senderUserId} sent invalid message text.`);
                socket.emit('error', '메시지 내용이 유효하지 않습니다.');
                return;
            }

            console.log(`Saving message from user ${senderUserId} for match ${messageMatchId}`);
            const newMessage = await Message.create({
                matchId: messageMatchId,
                senderId: senderUserId,
                text: trimmedText,
                timestamp: new Date() // Let DB handle default or use server time
            });
            console.log(`Message saved with ID: ${newMessage.id}`);

            const messageToSendToClient = {
                senderId: senderUserId,
                text: trimmedText,
                timestamp: newMessage.createdAt.getTime(), // Use DB timestamp
            };

            console.log(`Broadcasting message to room ${messageMatchId} (excluding sender ${senderUserId})`);
            // Use socket.broadcast.to to exclude the sender
            socket.broadcast.to(messageMatchId).emit('chat message', messageToSendToClient);
            console.log(`Broadcast successful for message ID: ${newMessage.id}`);

        } catch (error: any) {
            console.error(`[ERROR] Failed processing 'chat message' for match ${messageMatchId} from user ${senderUserId}:`, error);
            socket.emit('error', '메시지 저장 또는 전송 중 오류 발생');
        }
    });

    // --- Handle Force Leaving Chat Room (Permanent) ---
    socket.on('force-leave-chat', async (matchId: string) => {
        console.log(`User ${userId} requested to FORCE LEAVE chat room: ${matchId}`);
        if (matchId !== currentMatchId) {
             console.warn(`User ${userId} tried to leave match ${matchId} but current match is ${currentMatchId}. Ignoring.`);
             socket.emit('error', '잘못된 채팅방 나가기 요청입니다.');
             return;
        }

        const leavingUserId = userId;
        const leavingUserGender = userGender; // Get gender of the user leaving
        const matchIdToLeave = currentMatchId;
        currentMatchId = null; // Clear immediately

        let opponentUserId: number | null = null;
        let opponentSocketId: string | null = null;
        let opponentGender: Gender | null = null;

        try {
            const match = await Match.findOne({ where: { matchId: matchIdToLeave } });
            if (match) {
                opponentUserId = (match.user1Id === leavingUserId) ? match.user2Id : match.user1Id;
                // Find opponent socket and gender
                for (const [sid, connectedUser] of connectedUsers.entries()) {
                    if (connectedUser.userId === opponentUserId) {
                        opponentSocketId = sid;
                        opponentGender = connectedUser.gender; // Get gender from map
                        break;
                    }
                }
                // If opponent not in map (offline), try DB for gender
                if (!opponentGender && opponentUserId) {
                     try {
                         const opponentDb = await User.findByPk(opponentUserId, { attributes: ['gender'] });
                         opponentGender = opponentDb?.gender ?? null;
                     } catch (e: any) { console.error("Error checking offline opponent gender:", e); }
                }

                if (match.isActive) {
                    await match.update({ isActive: false });
                    console.log(`Match ${matchIdToLeave} DEACTIVATED in DB by user ${leavingUserId}.`);

                    // Notify opponent if connected
                    if (opponentSocketId) {
                        socket.broadcast.to(matchIdToLeave).emit('opponent-left-chat', { userId: leavingUserId });
                        console.log(`Notified opponent ${opponentUserId} (socket ${opponentSocketId}) that user ${leavingUserId} has left permanently.`);
                    }

                    // Reset DB occupation status for both users
                    await User.update({ occupation: false }, { where: { id: leavingUserId } });
                    if (opponentUserId) {
                        await User.update({ occupation: false }, { where: { id: opponentUserId } });
                        console.log(`Reset DB occupation=false for users ${leavingUserId} and ${opponentUserId}.`);
                    }

                    // Reset In-Memory State (isOccupied) for both users in the map
                    const initiatorInfo = connectedUsers.get(socket.id);
                    if (initiatorInfo) initiatorInfo.isOccupied = false;
                    if (opponentSocketId) {
                        const opponentInfo = connectedUsers.get(opponentSocketId);
                        if (opponentInfo) opponentInfo.isOccupied = false;
                    }
                    console.log(`[Force Leave] Reset Map isOccupied=false for users ${leavingUserId} and ${opponentUserId}.`);
                    console.log('[Force Leave] Connected Users Map:', Array.from(connectedUsers.values()).map(u => `${u.userId}(occ:${u.isOccupied})`));

                    // Add male user back to waitlist
                    let maleToAddBackId: number | null = null;
                    if (leavingUserGender === 'male') maleToAddBackId = leavingUserId;
                    else if (opponentGender === 'male') maleToAddBackId = opponentUserId;
                    if (maleToAddBackId) {
                        MatchingWaitList.findOrCreate({ where: { userId: maleToAddBackId }, defaults: { userId: maleToAddBackId, gender: 'male' }})
                            .then(([entry, created]: [any, boolean]) => {
                                if (created) console.log(`Male user ${maleToAddBackId} added back to MatchingWaitList after match end (gender: male).`);
                                else console.log(`Male user ${maleToAddBackId} was already in waitlist after match end? (Should not happen often)`);
                            })
                            .catch((error: any) => console.error(`Error adding male user ${maleToAddBackId} back to waitlist:`, error));
                    } else {
                        console.log("No male user identified to add back to waitlist.");
                    }

                    // --- Emit 'match_update' to BOTH users --- 
                    const leavingUserPayload = { status: leavingUserGender === 'male' ? 'waiting' : 'idle' };
                    const opponentPayload = { status: opponentGender === 'male' ? 'waiting' : 'idle' };

                    // Emit to leaving user
                    ioInstance.to(socket.id).emit('match_update', leavingUserPayload);
                    console.log(`[Force Leave] Sent match_update (${leavingUserPayload.status}) to leaving user ${leavingUserId}.`);

                    // Emit to opponent if connected
                    if (opponentSocketId) {
                        ioInstance.to(opponentSocketId).emit('match_update', opponentPayload);
                        console.log(`[Force Leave] Sent match_update (${opponentPayload.status}) to opponent ${opponentUserId}.`);
                         // Also emit opponent-left-chat for specific handling if needed
                         ioInstance.to(opponentSocketId).emit('opponent-left-chat', { userId: leavingUserId });
                    }
                    // ---------------------------------------------------

                    // Emit confirmation to the user who left (keep this? maybe redundant)
                    socket.emit('force-leave-success', { matchId: matchIdToLeave });

                } else {
                    console.log(`Match ${matchIdToLeave} was already inactive when user ${leavingUserId} tried to force leave.`);
                    const leavingUserPayload = { status: leavingUserGender === 'male' ? 'waiting' : 'idle' };
                    ioInstance.to(socket.id).emit('match_update', leavingUserPayload);
                    socket.emit('force-leave-success', { matchId: matchIdToLeave });
                }
            } else {
                console.warn(`Match ${matchIdToLeave} not found in DB when trying to force leave.`);
                const leavingUserPayload = { status: leavingUserGender === 'male' ? 'waiting' : 'idle' };
                ioInstance.to(socket.id).emit('match_update', leavingUserPayload);
                socket.emit('force-leave-success', { matchId: matchIdToLeave });
            }
        } catch (error) {
            console.error(`Error during force leave for match ${matchIdToLeave}:`, error);
            socket.emit('force-leave-error', { message: 'Error leaving chat room.' });
            // Try to reset state even on error
            try {
               const initiatorInfo = connectedUsers.get(socket.id);
               if (initiatorInfo) initiatorInfo.isOccupied = false;
               await User.update({ occupation: false }, { where: { id: leavingUserId } });
            } catch (resetError) { /* log resetError */ }
        } finally {
            socket.leave(matchIdToLeave);
            console.log(`User ${leavingUserId} left Socket.IO room: ${matchIdToLeave}`);
        }
    });
    // -----------------------------------------------

    // --- Handle Disconnection (Unexpected or Back Button) ---
    socket.on('disconnect', async (reason: string) => { // Make handler async
        const disconnectedUserId = userId;
        const disconnectedSocketId = socket.id;
        console.log(`User disconnected: ${disconnectedUserId} (Socket ID: ${disconnectedSocketId}, Reason: ${reason})`);

        // Get user state *before* removing from map
        const disconnectedUserInfo = connectedUsers.get(disconnectedSocketId);
        // const wasOccupied = disconnectedUserInfo?.isOccupied ?? false; // No longer needed immediately
        // const gender = disconnectedUserInfo?.gender ?? null; // No longer needed immediately
        // const matchIdWhenDisconnected = currentMatchId; // No longer needed immediately

        // Remove from female waiting list if present
        const waitingIndex = waitingUsers.findIndex((u) => u.socketId === disconnectedSocketId);
        if (waitingIndex > -1) {
            waitingUsers.splice(waitingIndex, 1);
            console.log(`Female user ${disconnectedUserId} removed from memory waiting list due to disconnect.`);
            console.log("Waiting List after disconnect:", waitingUsers.map(u => u.userId));
        }

        // Remove user from connectedUsers map
        connectedUsers.delete(disconnectedSocketId);
        console.log('[Disconnection] Connected Users Map:', Array.from(connectedUsers.values()).map(u => `${u.userId}(occ:${u.isOccupied})`));

        // --- REMOVED: Match Deactivation Logic on Disconnect ---
        // Simple disconnect should NOT automatically deactivate the match or change occupation status.
        // Rely on the 'force-leave-chat' event for intentional leaving.
        /*
        if (wasOccupied && matchIdWhenDisconnected) {
            console.log(`User ${disconnectedUserId} disconnected while in active match ${matchIdWhenDisconnected}. Deactivating match...`);
            // ... (Previous logic to find match, deactivate, update users, notify opponent, add male back) ...
        } else {
             console.log(`User ${disconnectedUserId} was not in an active tracked match upon disconnect.`);
             // Ensure DB occupation reflects this if inconsistent (Maybe remove this too?)
             await User.update({ occupation: false }, { where: { id: disconnectedUserId, occupation: true } })
                 .then(([affectedCount]: [number]) => { if (affectedCount > 0) console.log("Synced DB occupation to false for non-occupied disconnected user."); })
                 .catch((e: any)=>console.error("Error resetting occupation for non-occupied user on disconnect:", e));
        }
        */
       console.log(`[Disconnection] User ${disconnectedUserId} removed from connected lists. Match state remains unchanged.`);
    });
    // ----------------------------------------------------
}; 