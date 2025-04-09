'use client';

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import io, { Socket } from 'socket.io-client';
import { ArrowLeftIcon, PaperAirplaneIcon, ArrowLeftOnRectangleIcon } from '@heroicons/react/24/solid';
import { Montserrat, Inter } from 'next/font/google';

// Initialize fonts
const montserrat = Montserrat({ subsets: ['latin'], weight: ['600', '700'] });
const inter = Inter({ subsets: ['latin'] });

// Interface for messages including sender differentiation
interface Message {
    sender: 'me' | 'other'; // Differentiated sender for UI styling
    senderId?: number;      // Original sender ID from backend
    text: string;
    timestamp: number;
}

// Mock data for the other user (replace with actual data fetching)
// const mockOtherUser = {
//   name: 'Sumin',
//   profileImageUrl: 'https://via.placeholder.com/40',
// };

// --- Inner component that uses hooks ---
function ChatContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const params = useParams();
    const matchId = params.matchId as string;

    // Use useRef for socket instance
    const socketRef = useRef<Socket | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null); // Ref for scrolling to bottom

    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notification, setNotification] = useState<string | null>(null); // State for non-error notifications
    const [opponentLeft, setOpponentLeft] = useState(false); // State to track if opponent left
    const [currentUserId, setCurrentUserId] = useState<number | null>(null); // State for logged-in user's ID
    // Removed redundant socket state: const [socket, setSocket] = useState<Socket | null>(null);

    // --- Fetch current user ID & Handle URL Token ---
    useEffect(() => {
        const tokenFromUrl = searchParams.get('token');
        let initialToken = localStorage.getItem('authToken');
        let userIdFromStorage = localStorage.getItem('userId');

        if (tokenFromUrl) {
            console.log('ChatPage: Token found in URL, saving...');
            localStorage.setItem('authToken', tokenFromUrl);
            initialToken = tokenFromUrl;
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete('token');
            router.replace(newUrl.pathname + newUrl.search, { scroll: false });
            userIdFromStorage = null;
        }

        if (userIdFromStorage) {
            const parsedId = parseInt(userIdFromStorage, 10);
            if (!isNaN(parsedId)) {
                setCurrentUserId(parsedId);
                console.log('ChatPage: User ID found in localStorage:', parsedId);
            } else {
                 console.error("ChatPage: Invalid User ID found in localStorage.");
                 setError("사용자 정보가 유효하지 않습니다. 다시 로그인해주세요.");
            }
        } else if (initialToken) {
            console.log('ChatPage: No userId in storage, fetching user info with token...');
            // Use the correct API endpoint
            fetch('http://localhost:3001/api/profile/me', {
                 headers: { 'Authorization': `Bearer ${initialToken}` }
             })
             .then(async res => {
                 if (!res.ok) throw new Error(`Failed to fetch user info: ${res.statusText}`);
                 return res.json();
             })
             .then(userInfo => {
                 if (userInfo && userInfo.id) {
                     localStorage.setItem('userId', userInfo.id.toString());
                     setCurrentUserId(userInfo.id);
                     console.log('ChatPage: User ID fetched and stored:', userInfo.id);
                 } else {
                     throw new Error('User ID missing in fetched data');
                 }
             })
             .catch(err => {
                  console.error("ChatPage: Error fetching user info:", err);
                  setError("사용자 정보를 가져오는 데 실패했습니다. 다시 로그인해주세요.");
                  localStorage.removeItem('authToken');
             });
        } else {
            console.error("ChatPage: No token or userId found.");
            setError("로그인이 필요합니다.");
            // Optionally redirect to login if error persists
            // router.push('/');
        }

    }, [searchParams, router]); // Dependency array includes searchParams and router

    // --- Socket connection and event handling ---
    useEffect(() => {
        if (!matchId || currentUserId === null) {
            if (!matchId) setError("매치 ID가 URL에 없습니다.");
            else if (currentUserId === null && !error) setError("사용자 정보 로딩 중...");
            return;
        }

        const token = localStorage.getItem('authToken');
        if (!token) {
             setError("인증 토큰이 없습니다. 로그인이 필요합니다.");
             // Consider redirecting here if token is mandatory
             // router.push('/');
             return;
        }

        console.log(`ChatPage: Connecting socket for matchId: ${matchId}, userId: ${currentUserId}`);
        setError(null);
        setNotification(null);

        // Connect to Socket.IO server, send matchId in auth object
        socketRef.current = io('http://localhost:3001', {
            auth: { token, matchId }, // Send token AND matchId in auth
            // query: { matchId } // Removed matchId from query
            transports: ['websocket'] // Optional: Explicitly use websockets
        });

        const socket = socketRef.current;

        socket.on('connect', () => {
            console.log('ChatPage: Socket connected. ID:', socket.id);
            setIsConnected(true);
            setOpponentLeft(false);
            setError(null);
            setNotification(null);
            // Backend likely handles joining room automatically based on auth.matchId
            // If not, uncomment the line below:
            // socket.emit('join-chat-room', matchId);
        });

        socket.on('disconnect', (reason: string) => {
            console.log('ChatPage: Socket disconnected. Reason:', reason);
            setIsConnected(false);
             if (reason !== 'io client disconnect' && !opponentLeft) {
                 setNotification('채팅 서버와의 연결이 끊어졌습니다. 재연결을 시도합니다...');
             }
             if (reason === 'io server disconnect') {
                // Server forced disconnect (e.g., auth error during connection)
                setError('서버 연결이 종료되었습니다. 인증 문제일 수 있습니다.');
                // Optionally redirect to login
                // router.push('/');
            }
        });

        socket.on('connect_error', (err: Error) => {
             console.error('ChatPage: Socket connection error:', err.message);
             let errorMsg = `채팅 서버 연결 오류: ${err.message}`;
              if (err.message.includes('Authentication error')) {
                  errorMsg = '인증 오류로 연결에 실패했습니다. 다시 로그인해주세요.';
                  localStorage.removeItem('authToken'); // Clear invalid token
                  router.push('/'); // Redirect to login on auth failure
              } else if (err.message.includes('User not found')) {
                   errorMsg = '사용자 정보를 찾을 수 없습니다. 다시 로그인해주세요.';
                    localStorage.removeItem('authToken');
                    router.push('/');
              } else if (err.message.includes('Invalid token')) {
                    errorMsg = '토큰이 유효하지 않습니다. 다시 로그인해주세요.';
                     localStorage.removeItem('authToken');
                     router.push('/');
              }
             setError(errorMsg);
             setIsConnected(false);
        });

        // --- Listen for Chat History ---
        socket.on('chat-history', (history: { senderId: number, text: string, timestamp: number }[]) => {
            console.log('ChatPage: Received chat history:', history);
             if (currentUserId !== null) {
                 const formattedHistory: Message[] = history.map(msg => ({
                     senderId: msg.senderId,
                     text: msg.text,
                     timestamp: msg.timestamp,
                     sender: msg.senderId === currentUserId ? 'me' : 'other'
                 }));
                 setMessages(formattedHistory);
                 console.log('ChatPage: Formatted and set chat history.');
             } else {
                  console.warn("Received history but currentUserId is null, cannot format sender.");
             }
        });
        // -------------------------------

        // Listen for incoming messages
        socket.on('chat message', (message: { senderId: number, text: string, timestamp: number }) => {
             console.log('ChatPage: Received raw message:', message);
             if (currentUserId !== null) {
                 const formattedMessage: Message = {
                     senderId: message.senderId,
                     text: message.text,
                     timestamp: message.timestamp,
                     sender: message.senderId === currentUserId ? 'me' : 'other',
                 };
                 console.log('ChatPage: Formatted message:', formattedMessage);
                 setMessages((prevMessages) => [...prevMessages, formattedMessage]);
             } else {
                  console.warn("Received message but currentUserId is null, cannot determine sender.");
             }
        });

         // Listen for opponent disconnect/leave event
         socket.on('opponent-left-chat', (data: { userId?: number }) => {
             const opponentId = data?.userId || '상대방';
             console.log(`ChatPage: Opponent left chat (User ID: ${opponentId})`);
             setNotification('상대방이 채팅방을 나갔습니다. 메시지를 보낼 수 없습니다.');
             setOpponentLeft(true);
             // Keep socket connected for potential future reconnection or different handling
             // setIsConnected(false); // Optionally mark as disconnected for UI purposes if needed
         });

        // Listen for potential matching errors emitted to the socket
        socket.on('matching-error', (errorMessage: string) => {
            console.error('ChatPage: Received matching error from socket:', errorMessage);
            setError(errorMessage); // Display error from backend
        });


        // Cleanup function
        return () => {
            console.log(`ChatPage: Unmounting/cleanup for matchId: ${matchId}. Disconnecting socket.`);
            if (socketRef.current) {
                 socketRef.current.off('connect');
                 socketRef.current.off('disconnect');
                 socketRef.current.off('connect_error');
                 socketRef.current.off('chat message');
                 socketRef.current.off('opponent-left-chat');
                 socketRef.current.off('chat-history');
                 socketRef.current.off('matching-error'); // Unregister error listener
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    // Dependencies: re-run effect if essential IDs or router change
    }, [matchId, currentUserId, router]); // Removed 'error' from dependencies to avoid loops

    // --- Scroll to bottom when messages change ---
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // --- Send message handler ---
    const handleSendMessage = useCallback((e?: React.FormEvent) => {
        e?.preventDefault();
         if (newMessage.trim() && socketRef.current && isConnected && !opponentLeft && matchId && currentUserId !== null) {
             console.log(`ChatPage: Sending message: "${newMessage}" to matchId: ${matchId}`);
             const messageData = {
                 matchId: matchId, // matchId is needed for backend routing
                 text: newMessage.trim(),
                 // Backend should identify sender via socket.user.userId
             };
              // Optimistically add the message to the UI
              const optimisticMessage: Message = {
                   sender: 'me',
                   senderId: currentUserId,
                   text: newMessage.trim(),
                   timestamp: Date.now()
              };
              setMessages((prevMessages) => [...prevMessages, optimisticMessage]);

             socketRef.current.emit('chat message', messageData);
             setNewMessage('');
         } else {
              console.warn('ChatPage: Cannot send message.', {
                   hasText: !!newMessage.trim(),
                   isConnected,
                   opponentLeft,
                   hasMatchId: !!matchId,
                   hasUserId: currentUserId !== null,
                   hasSocket: !!socketRef.current
              });
         }
    }, [newMessage, isConnected, opponentLeft, matchId, currentUserId]); // Dependencies for the send handler

    // --- Leave Chat Handler ---
    const handleLeaveChat = useCallback(() => {
        if (socketRef.current && matchId) {
            console.log(`ChatPage: User leaving chat room: ${matchId}`);
             // Emit leave event only if connected, but always disconnect locally
             if (isConnected) {
                  socketRef.current.emit('leave-chat-room', matchId);
             }
             socketRef.current.disconnect(); // Force disconnect client-side
        }
        console.log("Redirecting to /main after leaving chat.");
        router.push('/main');
    }, [isConnected, matchId, router]); // Dependencies for leaving


    // --- Render Logic ---
     if (!matchId && !error) {
         return <div className={`flex justify-center items-center h-screen bg-gray-900 text-white ${inter.className}`}>매치 ID를 로드하는 중...</div>;
     }
      // Display critical errors prominently and allow user to go back to login
      if (error && (error.includes('로그인이 필요합니다') || error.includes('인증') || error.includes('사용자 정보'))) {
           return (
                <div className={`flex flex-col justify-center items-center h-screen bg-gray-900 text-white ${inter.className}`}>
                    <p className="text-red-500 mb-4 text-center">오류: {error}</p>
                    <button onClick={() => router.push('/')} className="mt-2 text-amber-400 underline">로그인 페이지로 이동</button>
                 </div>
            );
       }
       // Display connection/other errors within the chat UI if possible
       const connectionError = error && error.includes('연결 오류') ? error : null;


    return (
        <div className={`flex flex-col h-screen bg-black text-slate-100 ${inter.className}`}>
            {/* Header */}
            <header className="bg-gray-950 p-4 flex items-center justify-between sticky top-0 z-10 shadow-md">
                <div className="flex items-center">
                    <button onClick={() => router.push('/main')} className="text-slate-100 hover:text-slate-300 mr-3 p-1 rounded-full hover:bg-gray-800">
                         <ArrowLeftIcon className="h-6 w-6" />
                     </button>
                     {/* TODO: Replace with actual opponent info */}
                     <div className="w-10 h-10 rounded-full mr-3 bg-gray-700 border-2 border-amber-500"></div>
                    <h1 className={`text-lg font-semibold ${montserrat.className}`}>상대방</h1>
                </div>
                 {/* Display Connection Status */}
                <span className={`text-xs px-2 py-1 rounded ${isConnected ? 'bg-green-600' : opponentLeft ? 'bg-gray-600' : 'bg-red-600'} `}>
                     {isConnected ? '연결됨' : opponentLeft ? '상대방 나감' : '연결 끊김'}
                 </span>
                 {/* Leave Chat Button */}
                 <button
                    onClick={handleLeaveChat}
                    className="text-slate-400 hover:text-red-500 p-1 rounded-full hover:bg-gray-800 ml-2"
                    title="채팅방 나가기"
                 >
                     <ArrowLeftOnRectangleIcon className="h-6 w-6" />
                 </button>
            </header>

             {/* Display connection errors or notifications */}
              {(connectionError || notification) && (
                   <div className={`text-center p-2 text-sm ${connectionError ? 'text-red-300 bg-red-900' : 'text-yellow-300 bg-yellow-900'} bg-opacity-60`}>
                       {connectionError || notification}
                   </div>
              )}


            {/* Message List Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-black">
                {/* Display loading indicator or messages */}
                 {currentUserId === null && !error && <p className="text-center text-slate-400">사용자 정보 로딩 중...</p>}
                {messages.map((msg, index) => (
                    <div key={`${msg.timestamp}-${index}-${msg.senderId || 'optimistic'}`} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xs md:max-w-md px-4 py-2 rounded-2xl shadow ${msg.sender === 'me' ? 'bg-amber-600 text-slate-900' : 'bg-gray-800 text-slate-100'}`}>
                            <p className="text-sm break-words">{msg.text}</p>
                             {/* Simple timestamp display */}
                             <span className="text-xs opacity-70 block text-right mt-1">
                                 {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                             </span>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} /> {/* Scroll anchor */}
            </div>

            {/* Message Input Area */}
            <div className="bg-gray-950 p-4 sticky bottom-0 border-t border-gray-800">
                <form onSubmit={handleSendMessage} className="flex items-center gap-3">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                         placeholder={
                             !isConnected && !opponentLeft ? (connectionError || notification || "연결 끊김") :
                             opponentLeft ? "상대방이 나갔습니다." :
                             "메시지를 입력하세요..."
                         }
                        className={`flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-full focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-slate-100 placeholder-slate-400 ${inter.className}`}
                        disabled={!isConnected || opponentLeft || currentUserId === null} // Disable if not connected, opponent left, or user ID loading
                    />
                    <button
                        type="submit"
                        className={`p-2 rounded-full transition-colors ${newMessage.trim() && isConnected && !opponentLeft ? 'bg-amber-500 hover:bg-amber-600 text-slate-900' : 'bg-gray-700 text-slate-500 cursor-not-allowed'}`}
                        disabled={!newMessage.trim() || !isConnected || opponentLeft || currentUserId === null}
                    >
                        <PaperAirplaneIcon className="h-6 w-6" />
                    </button>
                </form>
            </div>
        </div>
    );
}

// --- Export with Suspense wrapper for useSearchParams ---
export default function ChatPage() {
    return (
        <Suspense fallback={
             <div className={`flex justify-center items-center h-screen bg-gray-900 text-white ${inter.className}`}>
                 채팅방 로딩 중...
             </div>
        }>
            <ChatContent />
        </Suspense>
    );
}