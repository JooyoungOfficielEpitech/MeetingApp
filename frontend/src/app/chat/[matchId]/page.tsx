'use client';

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
// Import useParams to get dynamic route segments
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import io, { Socket } from 'socket.io-client';
import { ArrowLeftIcon, PaperAirplaneIcon, ArrowLeftOnRectangleIcon } from '@heroicons/react/24/solid';
import { Montserrat, Inter } from 'next/font/google';
import axiosInstance from '@/utils/axiosInstance';
import AuthGuard from '@/components/AuthGuard';

// Initialize fonts
const montserrat = Montserrat({ subsets: ['latin'], weight: ['600', '700'] });
const inter = Inter({ subsets: ['latin'] });

// Define message type - Ensure this is accessible throughout the component
interface Message {
    sender: 'me' | 'other'; // Differentiated sender for UI styling
    senderId?: number;      // Original sender ID from backend
    text: string;
    timestamp: number;      // Expecting milliseconds from backend
}

// 매치 정보를 위한 인터페이스 추가
interface MatchUser {
    id: number;
    name?: string;      // user2에 있음
    nickname?: string;  // user1에 있음
    gender?: string;
    age?: number;
    city?: string;
    mbti?: string;
    height?: number;
    occupation?: string;
    profileImage?: string;      // 단일 이미지 URL
    profileImageUrls?: string[]; // 이미지 URL 배열
    createdAt?: string;
}

interface MatchData {
    matchId: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    user1: MatchUser;
    user2: MatchUser;
}

// --- Inner component that uses hooks ---
function ChatContent() {
    const router = useRouter();
    const searchParams = useSearchParams(); // Used for potential token in URL
    const params = useParams(); // Hook to access dynamic route parameters
    // Get matchId from URL parameters using useParams
    const matchId = params.matchId as string;

    // Use useRef for socket instance - preferred for mutable instances like sockets
    const socketRef = useRef<Socket | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null); // Ref for scrolling to bottom

    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notification, setNotification] = useState<string | null>(null);
    // Use opponentLeft state as originally intended
    const [opponentLeft, setOpponentLeft] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<number | null>(null);
    // 상대방 정보를 위한 상태 추가
    const [opponentId, setOpponentId] = useState<number | null>(null);
    const [opponentNickname, setOpponentNickname] = useState<string>('');
    const [matchData, setMatchData] = useState<MatchData | null>(null);

    // 상대방 정보를 가져오는 함수 추가
    const fetchOpponentInfo = useCallback(async (chatMatchId: string) => {
        console.log(`ChatContent: Fetching opponent info for match: ${chatMatchId}`);
        if (!currentUserId) {
            console.warn('Cannot fetch opponent info: currentUserId is null');
            return;
        }
        
        try {
            const response = await axiosInstance.get(`/api/matches/${chatMatchId}`);
            
            if (response.status === 200) {
                const fetchedData = response.data as {
                    matchId: string;
                    isActive: boolean;
                    createdAt: string;
                    updatedAt: string;
                    user1: any;
                    user2: any;
                };
                // 자세한 데이터 구조 로깅
                console.log('ChatContent: Raw API response data:', JSON.stringify(fetchedData, null, 2));
                
                // 데이터 구조에 맞게 매핑
                const matchData: MatchData = {
                    matchId: fetchedData.matchId,
                    isActive: fetchedData.isActive,
                    createdAt: fetchedData.createdAt,
                    updatedAt: fetchedData.updatedAt,
                    user1: {
                        ...fetchedData.user1,
                        // profileImage나 profileImageUrls 중 하나만 있으면 서로 변환
                        profileImageUrls: fetchedData.user1.profileImageUrls || 
                            (fetchedData.user1.profileImage ? [fetchedData.user1.profileImage] : undefined)
                    },
                    user2: {
                        ...fetchedData.user2,
                        // profileImage나 profileImageUrls 중 하나만 있으면 서로 변환
                        profileImageUrls: fetchedData.user2.profileImageUrls || 
                            (fetchedData.user2.profileImage ? [fetchedData.user2.profileImage] : undefined)
                    }
                };
                
                // 매치 데이터 상태 저장
                setMatchData(matchData);
                console.log('ChatContent: Processed match data:', matchData);
                
                // 현재 사용자의 ID와 비교하여 상대방 정보 추출
                const opponent = matchData.user1.id === currentUserId ? matchData.user2 : matchData.user1;
                
                if (opponent) {
                    setOpponentId(opponent.id);
                    // 닉네임 또는 이름 사용 (둘 다 없으면 '상대방')
                    setOpponentNickname(opponent.nickname || opponent.name || '상대방');
                    console.log('ChatContent: Opponent details:', opponent);
                } else {
                    console.error('Failed to determine opponent from match data');
                    setOpponentNickname('상대방');
                }
            } else {
                console.error('Failed to fetch match details:', response.statusText);
                setOpponentNickname('상대방');
            }
        } catch (error) {
            console.error('Error fetching match details:', error);
            setOpponentNickname('상대방');
        }
    }, [currentUserId]);

    // --- Fetch current user ID & Handle URL Token (Runs once or if searchParams change) ---
    useEffect(() => {
        const tokenFromUrl = searchParams.get('token');
        let initialToken = localStorage.getItem('token');
        let userIdFromStorage = localStorage.getItem('userId');

        // Handle token potentially passed in URL (e.g., after OAuth callback)
        if (tokenFromUrl) {
            console.log('ChatContent: Token found in URL, saving...');
            localStorage.setItem('token', tokenFromUrl);
            initialToken = tokenFromUrl;
            // Clean the token from the URL without reloading
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete('token');
            router.replace(newUrl.pathname + newUrl.search, { scroll: false });
            userIdFromStorage = null; // Force refetch of user ID with the new token
        }

        // Try to get user ID from localStorage first
        if (userIdFromStorage) {
            const parsedId = parseInt(userIdFromStorage, 10);
            if (!isNaN(parsedId)) {
                setCurrentUserId(parsedId);
                console.log('ChatContent: User ID found in localStorage:', parsedId);
            } else {
                 console.error("ChatContent: Invalid User ID found in localStorage.");
                 setError("User information is invalid. Please log in again.");
                 localStorage.removeItem('userId'); // Remove invalid ID
                 localStorage.removeItem('token'); // Also remove token as state is inconsistent
                 router.push('/'); // Redirect to login
            }
        // If no valid userId in storage, but we have a token, fetch user info
        } else if (initialToken) {
            console.log('ChatContent: No userId in storage, fetching user info with token...');
            // Use axiosInstance with the correct API endpoint for user profile
            axiosInstance.get('/api/profile/me')
             .then(response => {
                 const userInfo = response.data as { id: number };
                 if (userInfo && userInfo.id) {
                     localStorage.setItem('userId', userInfo.id.toString());
                     setCurrentUserId(userInfo.id);
                     console.log('ChatContent: User ID fetched and stored:', userInfo.id);
                 } else {
                     throw new Error('User ID missing in fetched data');
                 }
             })
             .catch(err => {
                  console.error("ChatContent: Error fetching user info:", err);
                  // Handle specific errors based on message
                  if (err.response?.status === 401 || err.response?.status === 403) {
                       setError("Authentication failed. Please log in again.");
                  } else {
                       setError("Failed to fetch user information. Please log in again.");
                  }
                  localStorage.removeItem('token'); // Clear token on fetch failure
                  localStorage.removeItem('userId'); // Clear userId as well
                  router.push('/'); // Redirect to login
             });
        } else {
            console.error("ChatContent: No token or userId found.");
            setError("Login required.");
            router.push('/'); // Redirect to login if no token at all
        }

    // Only run this effect when the component mounts or if searchParams change (for URL token)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams, router]);

    // --- Socket connection and event handling ---
    useEffect(() => {
        // **Guard Clause: Ensure matchId from URL params is valid before proceeding**
        if (!matchId || typeof matchId !== 'string') {
            console.error("ChatContent: Invalid or missing matchId in URL parameters.", matchId);
            setError("Invalid chat room ID.");
            setIsConnected(false); // Ensure connection status is false
            return; // Stop execution if matchId is invalid
        }

        // Only attempt connection if we have the current user's ID
        if (currentUserId === null) {
             console.log("ChatContent: Waiting for currentUserId before connecting socket.");
             //setError("Loading user information..."); // Optionally set a loading state
             return; // Don't connect yet
        }

        // **Important: Get token *inside* useEffect or use auth function**
        // Getting it here ensures the latest token is used if login happens while component is mounted
        const token = localStorage.getItem('token');
        if (!token) {
             setError("Authentication token not found. Login required.");
             router.push('/'); // Redirect to login if no token
             return;
        }

        // If socket already exists (e.g., from a previous connection attempt or HMR), disconnect first
        if (socketRef.current) {
            console.log("ChatContent: Disconnecting existing socket before reconnecting.");
            socketRef.current.disconnect();
        }


        console.log(`ChatContent: Setting up socket connection for matchId: ${matchId}, userId: ${currentUserId}`);
        setError(null); // Clear previous errors
        setNotification(null); // Clear previous notifications
        setOpponentLeft(false); // Reset opponent left status on new connection setup

        // **Connect to Socket.IO server using function for auth option**
        console.log(`ChatContent: Preparing to connect socket...`);
        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
        const newSocket = io(socketUrl, { // Use environment variable
            // Provide auth as a function to be called on each connection/reconnection attempt
            auth: (cb) => {
                console.log("Auth function called. Getting token and matchId...");
                const currentToken = localStorage.getItem('token'); // Get latest token
                // Ensure matchId from params is used (already validated above)
                if (!currentToken) {
                    console.error("Auth function: No token found!");
                    // Handle error appropriately, maybe call cb with an error?
                    // Or rely on backend to reject connection.
                }
                cb({ token: currentToken, matchId: matchId });
            },
            transports: ['websocket'] // Optional: Force websocket transport
        });
        socketRef.current = newSocket; // Assign the new socket instance to the ref

        // --- Socket Event Listeners ---
        newSocket.on('connect', () => {
            console.log('ChatContent: Socket connected. ID:', newSocket.id);
            setIsConnected(true);
            setOpponentLeft(false); // Ensure opponent is not marked as left on successful connect
            setError(null); // Clear errors on successful connection
            setNotification(null);
            
            // 연결 성공 시 상대방 정보 가져오기 (초기 로딩)
            if (matchId && currentUserId) {
                fetchOpponentInfo(matchId);
            }
            // Backend automatically sends history now upon successful join
        });

        // match-success 이벤트 핸들러 수정
        newSocket.on('match-success', async (data: { matchId: string, opponentId: number }) => {
            console.log('ChatContent: Match success received:', data);
            setOpponentId(data.opponentId);
            
            // 매치 성공 이벤트에서도 상대방 정보 가져오기
            await fetchOpponentInfo(data.matchId);
        });

        newSocket.on('disconnect', (reason: string) => {
            console.log('ChatContent: Socket disconnected. Reason:', reason);
            setIsConnected(false);
             // No automatic notification or opponentLeft change on simple disconnect
             if (reason !== 'io client disconnect') {
                 // Only show notification for unexpected disconnects
                 setNotification('Connection to chat server lost.');
             }
        });

        newSocket.on('connect_error', (err: Error) => {
             console.error('ChatContent: Socket connection error:', err);
             let errorMsg = `Chat server connection error: ${err.message}`;
              // Provide more specific feedback based on backend error messages
              if (err.message.includes('Authentication error')) {
                  errorMsg = 'Connection failed due to authentication error. Please log in again.';
                  localStorage.removeItem('token');
                  localStorage.removeItem('userId');
                  router.push('/');
              } else if (err.message.includes('User not found')) {
                   errorMsg = 'User information not found. Please log in again.';
                    localStorage.removeItem('token');
                    localStorage.removeItem('userId');
                    router.push('/');
              } else if (err.message.includes('Invalid token')) {
                    errorMsg = 'Invalid token. Please log in again.';
                     localStorage.removeItem('token');
                     localStorage.removeItem('userId');
                     router.push('/');
              } else if (err.message.includes('만료되었거나 유효하지 않은 채팅방입니다')) {
                    // Handle error from backend if match is inactive on connect
                    errorMsg = 'Expired or invalid chat room.';
              }
             setError(errorMsg);
             setIsConnected(false);
        });

        // --- Listen for Chat History ---
        newSocket.on('chat-history', (history: { senderId: number, text: string, timestamp: number }[]) => {
            console.log('ChatContent: Received chat history:', history);
             if (currentUserId !== null) {
                 const formattedHistory: Message[] = history.map(msg => ({
                     senderId: msg.senderId,
                     text: msg.text,
                     timestamp: msg.timestamp, // Expecting milliseconds
                     sender: msg.senderId === currentUserId ? 'me' : 'other'
                 }));
                 setMessages(formattedHistory);
                 console.log('ChatContent: Formatted and set chat history.');
             } else {
                  console.warn("ChatContent: Received history but currentUserId is null.");
             }
        });

        // --- Listen for new incoming messages ---
        newSocket.on('chat message', (message: { senderId: number, text: string, timestamp: number }) => {
             console.log('ChatContent: Received raw message:', message);
             if (currentUserId !== null && message.senderId !== currentUserId) {
                 const formattedMessage: Message = {
                     senderId: message.senderId,
                     text: message.text,
                     timestamp: message.timestamp, // Expecting milliseconds
                     sender: 'other', // We already know it's not 'me' because of the check
                 };
                 console.log('ChatContent: Formatted new message from opponent:', formattedMessage);
                 setMessages((prevMessages) => [...prevMessages, formattedMessage]);
             } else if (currentUserId !== null && message.senderId === currentUserId) {
                 // Log if the sender receives their own message back (shouldn't happen with broadcast)
                 console.warn("ChatContent: Received own message back from server despite broadcast. Ignoring.", message);
             } else {
                  console.warn("ChatContent: Received message but currentUserId is null.");
             }
        });

         // --- Listen for opponent leaving the chat ---
         newSocket.on('opponent-left-chat', (data: { userId: number }) => {
             console.log(`ChatContent: Opponent left chat permanently (User ID: ${data.userId})`);
             setNotification('Opponent has left the chat. You can no longer send messages.'); // Use notification instead of error
             setOpponentLeft(true); // Set opponent left state
             // DO NOT set isConnected to false here. The socket is still connected to the server.
             // Optionally disconnect the socket if no further interaction is needed
             // newSocket.disconnect();
         });

        // --- Listen for forced leave success/error ---
        const handleForceLeaveSuccess = (data: { matchId: string }) => {
            console.log(`ChatContent: Successfully left match ${data.matchId}. Disconnecting and redirecting...`);
            setNotification('You have left the chat room.');
            // Disconnect socket BEFORE redirecting
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null; // Clear the ref after disconnect
            }
            router.push('/main');
        };
        const handleForceLeaveError = (data: { message: string }) => {
            console.error(`ChatContent: Error leaving chat: ${data.message}`);
            setError(`Error leaving chat: ${data.message}`);
        };

        newSocket.on('force-leave-success', handleForceLeaveSuccess);
        newSocket.on('force-leave-error', handleForceLeaveError);

        // --- Listen for generic errors from socket ---
        newSocket.on('error', (errorMessage: string) => {
             console.error('ChatContent: Received error event from socket:', errorMessage);
             setError(errorMessage);
             // Determine if specific errors require disconnecting or redirecting
             if (errorMessage.includes('비활성화된 채팅방') || errorMessage.includes('Invalid chat room')) {
                 setOpponentLeft(true); // Mark as effectively ended
                 setIsConnected(false);
             }
        });

        // --- Cleanup on component unmount or before reconnecting ---
        return () => {
            console.log(`ChatContent: Cleaning up socket connection for matchId: ${matchId}`);
            if (newSocket) {
                newSocket.off('connect');
                newSocket.off('disconnect');
                newSocket.off('connect_error');
                newSocket.off('chat-history');
                newSocket.off('chat message');
                newSocket.off('opponent-left-chat');
                newSocket.off('force-leave-success', handleForceLeaveSuccess);
                newSocket.off('force-leave-error', handleForceLeaveError);
                newSocket.off('error');
                if (newSocket.connected) {
                    newSocket.disconnect();
                }
            }
            socketRef.current = null;
        };
    // Dependencies for the effect: fetchOpponentInfo도 의존성에 추가
    }, [matchId, currentUserId, router, fetchOpponentInfo]);

    // --- Scroll to bottom when messages change ---\
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // --- Send message handler ---
    // Ensure this uses opponentLeft state correctly
    const handleSendMessage = useCallback((e?: React.FormEvent) => {
        e?.preventDefault();
         const textToSend = newMessage.trim();
         // Check opponentLeft state before sending
         if (textToSend && socketRef.current && isConnected && !opponentLeft && matchId && currentUserId !== null) {
             console.log(`ChatContent: Sending message: "${textToSend}" to matchId: ${matchId}`);
             const messageData = {
                 matchId: matchId,
                 text: textToSend,
                 // SenderId is determined by backend via socket connection
             };
              // Optimistically add the message to the UI immediately
              const optimisticMessage: Message = { // Ensure Message type is accessible here
                   sender: 'me',
                   senderId: currentUserId, // Set senderId for local display
                   text: textToSend,
                   timestamp: Date.now() // Use client time for optimistic update
              };
              setMessages((prevMessages) => [...prevMessages, optimisticMessage]);

             // Emit the event to the backend
             socketRef.current.emit('chat message', messageData);
             setNewMessage(''); // Clear the input field
         } else {
              // Log why sending failed for debugging
              console.warn('ChatContent: Cannot send message. Conditions not met:', {
                   hasText: !!textToSend,
                   isConnected,
                   opponentLeft: opponentLeft, // Corrected state name
                   hasMatchId: !!matchId,
                   hasUserId: currentUserId !== null,
                   hasSocket: !!socketRef.current
              });
              // Optionally provide user feedback (e.g., brief error message)
              if (opponentLeft) setError("Cannot send message because the opponent has left.");
              else if (!isConnected) setError("Cannot send message because you are not connected.");
         }
    }, [newMessage, isConnected, opponentLeft, matchId, currentUserId]); // Include opponentLeft in dependencies

    // --- Handle leaving the chat room permanently ---
    const handleLeaveChat = useCallback(() => {
        if (socketRef.current && matchId) {
            console.log(`ChatContent: User clicking PERMANENT LEAVE for room: ${matchId}`);
            // Only emit the event, do not disconnect or redirect here
            socketRef.current.emit('force-leave-chat', matchId);
            console.log(`ChatContent: Emitted 'force-leave-chat' for match: ${matchId}`);
            // setNotification('Leaving chat room...'); // Optional: Indicate action started
        } else {
            console.error('Cannot leave chat: Socket not connected or matchId missing.');
            setError('Cannot leave chat at the moment.');
        }
    }, [matchId]); // Dependency: matchId

    // --- Render Logic ---
     // Display loading or critical error before main UI
     if (!matchId && !error) {
         return <div className={`flex justify-center items-center h-screen bg-gray-900 text-white ${inter.className}`}>Loading valid match ID...</div>;
     }
     // Handle critical errors that prevent chat (auth, user ID fetch issues, invalid match)
      if (error && (error.includes('Login required') || error.includes('Authentication') || error.includes('User information') || error.includes('Expired or invalid chat room'))) {
           return (
                <div className={`flex flex-col justify-center items-center h-screen bg-gray-900 text-white ${inter.className}`}>
                    <p className="text-red-500 mb-4 text-center px-4">{error}</p>
                    <button onClick={() => router.push('/')} className="mt-2 text-amber-400 underline">Go to Login Page</button>
                 </div>
            );
       }
       // Display connection/other errors within the chat UI if possible
       const displayError = error && !error.includes('Login required') && !error.includes('Expired') ? error : null; // Filter out critical errors already handled


    return (
        <div className={`flex h-screen bg-black text-slate-100 ${inter.className}`}>
            {/* 채팅 영역 - 왼쪽 */}
            <div className="flex flex-col w-2/3 border-r border-gray-800">
                {/* Header */}
                <header className="bg-gray-950 p-4 flex items-center justify-between sticky top-0 z-10 shadow-md">
                    {/* Left side: Use simple router.push for temporary leave (Back button) */}
                    <div className="flex items-center">
                        <button onClick={() => router.push('/main')} className="text-slate-100 hover:text-slate-300 mr-3 p-1 rounded-full hover:bg-gray-800">
                             <ArrowLeftIcon className="h-6 w-6" />
                         </button>
                         {/* Placeholder for opponent info - Fetch or receive this via socket */}
                         <div className="w-10 h-10 rounded-full mr-3 bg-gray-700 border-2 border-amber-500 flex-shrink-0">
                            {opponentId && matchData && (
                                <div className="w-full h-full rounded-full overflow-hidden">
                                    {(() => {
                                        const opponent = matchData.user1?.id === currentUserId ? matchData.user2 : matchData.user1;
                                        if (opponent?.profileImage) {
                                            return <img src={opponent.profileImage} alt={opponentNickname} className="w-full h-full object-cover" />;
                                        } else if (opponent?.profileImageUrls && opponent.profileImageUrls.length > 0) {
                                            return <img src={opponent.profileImageUrls[0]} alt={opponentNickname} className="w-full h-full object-cover" />;
                                        }
                                        return null;
                                    })()}
                                </div>
                            )}
                         </div>
                        <h1 className={`text-lg font-semibold truncate ${montserrat.className}`}>
                            {/* Opponent Name */}
                            {opponentNickname || 'Opponent'}
                        </h1>
                    </div>
                     {/* Right side: Status and Permanent Leave Button */}
                     <div className="flex items-center">
                        {/* Connection Status Indicator - based on isConnected and opponentLeft */}
                        <span className={`text-xs px-2 py-1 rounded whitespace-nowrap ${opponentLeft ? 'bg-gray-600 text-gray-200' : (isConnected ? 'bg-green-600 text-green-100' : 'bg-red-600 text-red-100')} `}>
                            {opponentLeft ? 'Opponent Left' : (isConnected ? 'Connected' : 'Disconnected')}
                        </span>
                        {/* Permanent Leave Button */}
                        <button
                            onClick={handleLeaveChat} // Uses force-leave-chat event
                            className="text-slate-400 hover:text-red-500 p-1 rounded-full hover:bg-gray-800 ml-2"
                            title="Leave Chat Room (Permanent)"
                        >
                            <ArrowLeftOnRectangleIcon className="h-6 w-6" />
                        </button>
                    </div>
                </header>

                 {/* Display connection errors or notifications */}
                  {(displayError || notification) && (
                       <div className={`text-center p-2 text-sm ${displayError ? 'text-red-300 bg-red-900' : 'text-yellow-300 bg-yellow-900'} bg-opacity-80`}>
                           {displayError || notification}
                       </div>
                  )}


                {/* Message List Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-black">
                     {/* Display loading indicator for user ID */}
                     {currentUserId === null && !error && <p className="text-center text-slate-400">Loading user information...</p>}
                     {/* Display message if history is empty */}
                     {currentUserId !== null && messages.length === 0 && !error && <p className="text-center text-slate-500">No messages yet. Start the conversation!</p>}
                    {/* Render messages */}
                    {messages.map((msg, index) => (
                        <div key={`${msg.timestamp}-${index}-${msg.senderId || 'optimistic'}`} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-xs md:max-w-md px-4 py-2 rounded-2xl shadow ${msg.sender === 'me' ? 'bg-amber-600 text-black' : 'bg-gray-800 text-slate-100'}`}>
                                <p className="text-sm break-words">{msg.text}</p>
                                 {/* Simple timestamp display */}
                                 <span className="text-xs opacity-70 block text-right mt-1">
                                     {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                 </span>
                            </div>
                        </div>
                    ))}
                    {/* Scroll anchor */}
                    <div ref={messagesEndRef} />
                </div>

                {/* Message Input Area */}
                <div className="bg-gray-950 p-4 sticky bottom-0 border-t border-gray-800">
                    <form onSubmit={handleSendMessage} className="flex items-center gap-3">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                             placeholder={
                                 !isConnected ? (displayError || notification || "Connecting...") :
                                 opponentLeft ? "Opponent has left." : // Use opponentLeft
                                 "Type a message..."
                             }
                            className={`flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-full focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-slate-100 placeholder-slate-400 disabled:opacity-60 disabled:cursor-not-allowed ${inter.className}`}
                            // Disable based on connection AND opponentLeft status AND user ID loading
                            disabled={!isConnected || opponentLeft || currentUserId === null}
                        />
                        <button
                            type="submit"
                            className={`p-2 rounded-full transition-colors flex-shrink-0 ${newMessage.trim() && isConnected && !opponentLeft ? 'bg-amber-500 hover:bg-amber-600 text-slate-900' : 'bg-gray-700 text-slate-500 cursor-not-allowed'}`}
                            // Disable based on connection AND opponentLeft status AND user ID loading + if message empty
                            disabled={!newMessage.trim() || !isConnected || opponentLeft || currentUserId === null}
                        >
                            <PaperAirplaneIcon className="h-6 w-6" />
                        </button>
                    </form>
                </div>
            </div>
            
            {/* 상대방 프로필 영역 - 오른쪽 */}
            <div className="w-1/3 bg-gray-900 overflow-y-auto">
                <div className="p-6">
                    <h2 className={`text-xl font-semibold mb-6 text-center text-amber-500 ${montserrat.className}`}>프로필 정보</h2>
                    
                    {/* 상대방 정보 로딩 중 표시 */}
                    {!opponentId && (
                        <div className="flex items-center justify-center h-40">
                            <p className="text-gray-400">프로필 정보 로딩 중...</p>
                        </div>
                    )}
                    
                    {opponentId && matchData && (
                        <div>
                            {/* 프로필 사진 갤러리 */}
                            <div className="mb-6">
                                <h3 className="text-sm uppercase tracking-wider text-gray-400 mb-3">프로필 사진</h3>
                                <div className="grid grid-cols-2 gap-2">
                                    {(() => {
                                        const opponent = matchData.user1.id === currentUserId ? matchData.user2 : matchData.user1;
                                        
                                        // 이미지 URL 배열 생성 (profileImageUrls 또는 profileImage 사용)
                                        let imageUrls: string[] = [];
                                        
                                        if (opponent.profileImageUrls && opponent.profileImageUrls.length > 0) {
                                            imageUrls = [...opponent.profileImageUrls];
                                        } else if (opponent.profileImage) {
                                            imageUrls = [opponent.profileImage];
                                        }
                                        
                                        if (imageUrls.length > 0) {
                                            return imageUrls.map((url, index) => (
                                                <div key={index} className="aspect-square rounded-md overflow-hidden bg-gray-800">
                                                    <img src={url} alt={`Profile ${index + 1}`} className="w-full h-full object-cover" />
                                                </div>
                                            ));
                                        } else {
                                            return (
                                                <div className="col-span-2 aspect-video rounded-md bg-gray-800 flex items-center justify-center">
                                                    <p className="text-gray-500">사진 없음</p>
                                                </div>
                                            );
                                        }
                                    })()}
                                </div>
                            </div>
                            
                            {/* 기본 정보 */}
                            <div className="space-y-4">
                                {/* 닉네임 */}
                                <div>
                                    <h3 className="text-sm uppercase tracking-wider text-gray-400 mb-1">닉네임</h3>
                                    <p className="font-medium text-lg">{opponentNickname}</p>
                                </div>
                                
                                {/* 성별 */}
                                <div>
                                    <h3 className="text-sm uppercase tracking-wider text-gray-400 mb-1">성별</h3>
                                    <p>{(() => {
                                        const opponent = matchData.user1.id === currentUserId ? matchData.user2 : matchData.user1;
                                        return opponent.gender === 'male' ? '남성' : opponent.gender === 'female' ? '여성' : '정보 없음';
                                    })()}</p>
                                </div>
                                
                                {/* 나이 */}
                                <div>
                                    <h3 className="text-sm uppercase tracking-wider text-gray-400 mb-1">나이</h3>
                                    <p>{(() => {
                                        const opponent = matchData.user1.id === currentUserId ? matchData.user2 : matchData.user1;
                                        return opponent.age ? `${opponent.age}세` : '정보 없음';
                                    })()}</p>
                                </div>
                                
                                {/* 사는 곳 */}
                                <div>
                                    <h3 className="text-sm uppercase tracking-wider text-gray-400 mb-1">지역</h3>
                                    <p>{(() => {
                                        const opponent = matchData.user1.id === currentUserId ? matchData.user2 : matchData.user1;
                                        return opponent.city || '정보 없음';
                                    })()}</p>
                                </div>
                                
                                {/* MBTI */}
                                <div>
                                    <h3 className="text-sm uppercase tracking-wider text-gray-400 mb-1">MBTI</h3>
                                    <p>{(() => {
                                        const opponent = matchData.user1.id === currentUserId ? matchData.user2 : matchData.user1;
                                        return opponent.mbti || '정보 없음';
                                    })()}</p>
                                </div>
                                
                                {/* 키 */}
                                <div>
                                    <h3 className="text-sm uppercase tracking-wider text-gray-400 mb-1">키</h3>
                                    <p>{(() => {
                                        const opponent = matchData.user1.id === currentUserId ? matchData.user2 : matchData.user1;
                                        return opponent.height ? `${opponent.height}cm` : '정보 없음';
                                    })()}</p>
                                </div>
                                
                                {/* 가입일 */}
                                <div>
                                    <h3 className="text-sm uppercase tracking-wider text-gray-400 mb-1">가입일</h3>
                                    <p>{(() => {
                                        const opponent = matchData.user1.id === currentUserId ? matchData.user2 : matchData.user1;
                                        return opponent.createdAt 
                                            ? new Date(opponent.createdAt).toLocaleDateString('ko-KR', {year: 'numeric', month: 'long', day: 'numeric'})
                                            : '정보 없음';
                                    })()}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// --- Export with Suspense wrapper for useSearchParams ---
export default function ChatPage() {
    return (
        <AuthGuard requiredStatus="active">
            <Suspense fallback={
                <div className={`flex justify-center items-center h-screen bg-gray-900 text-white ${inter.className}`}>
                    채팅방 로딩 중...
                </div>
            }>
                <ChatContent />
            </Suspense>
        </AuthGuard>
    );
}