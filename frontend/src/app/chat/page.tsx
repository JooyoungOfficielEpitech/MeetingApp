'use client';

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import io, { Socket } from 'socket.io-client';
import { ArrowLeftIcon, PaperAirplaneIcon, ArrowLeftOnRectangleIcon } from '@heroicons/react/24/solid';
import { Montserrat, Inter } from 'next/font/google';
import axiosInstance from '@/utils/axiosInstance';
import AuthGuard from '@/components/AuthGuard';

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
const mockOtherUser = {
  name: 'Sumin',
  profileImageUrl: 'https://via.placeholder.com/40',
};

// --- Inner component that uses hooks ---
function ChatContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const matchId = searchParams.get('matchId');

    const socketRef = useRef<Socket | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null); // Ref for scrolling to bottom

    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notification, setNotification] = useState<string | null>(null); // State for non-error notifications
    const [opponentLeft, setOpponentLeft] = useState(false); // State to track if opponent left
    const [currentUserId, setCurrentUserId] = useState<number | null>(null); // State for logged-in user's ID

    // --- Fetch current user ID & Handle URL Token --- 
    useEffect(() => {
        const tokenFromUrl = searchParams.get('token');
        let initialToken = localStorage.getItem('token');
        let userIdFromStorage = localStorage.getItem('userId');

        // If token exists in URL (e.g., from Google redirect with active match)
        if (tokenFromUrl) {
            console.log('ChatPage: Token found in URL, saving to localStorage.');
            localStorage.setItem('token', tokenFromUrl);
            initialToken = tokenFromUrl;
            // Clean URL
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete('token');
            router.replace(newUrl.pathname + newUrl.search, { scroll: false });
            // Reset userIdFromStorage as the URL token implies a new login session
            userIdFromStorage = null; 
        }

        // If userId is already in storage, use it
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
            // If no userId in storage BUT we have a token (from URL or existing storage)
            // Fetch userId using the token
            console.log('ChatPage: No userId in storage, fetching user info with token...');
            axiosInstance.get('/api/users/me')
             .then(response => {
                 const userInfo = response.data as { id: number };
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
                  localStorage.removeItem('token'); // Clear potentially invalid token
             });
        } else {
            // No token and no userId
            console.error("ChatPage: No token or userId found.");
            setError("로그인이 필요합니다.");
        }

    }, [searchParams, router]); // Run when searchParams change (e.g., token removal)

    // --- Socket connection and event handling ---
    useEffect(() => {
        // Only proceed if we have a valid matchId and user ID
        if (!matchId || currentUserId === null) {
            if (!matchId) setError("매치 ID가 URL에 없습니다.");
            else if (currentUserId === null && !error) setError("사용자 정보 로딩 중..."); // Informative message if userId is loading
            return; 
        }
        
        const token = localStorage.getItem('token'); // Get potentially updated token
        if (!token) {
             console.error('ChatPage: No authentication token found.');
             setError('로그인이 필요합니다. 로그인 페이지로 이동합니다.');
             router.push('/');
             return;
        }
        
        console.log(`ChatPage: Connecting socket for matchId: ${matchId}, userId: ${currentUserId}`);
        setError(null); // Clear errors before connecting
        setNotification(null);

        // Connect to Socket.IO server
        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
        socketRef.current = io(socketUrl, { // Use environment variable
            auth: { token },
            query: { matchId } // Send matchId in query
        });

        const socket = socketRef.current;

        socket.on('connect', () => {
            console.log('ChatPage: Socket connected. ID:', socket.id);
            setIsConnected(true);
            setOpponentLeft(false); // Reset opponent left status on new connection
            setError(null);
            setNotification(null);
            socket.emit('join-chat-room', matchId);
        });

        socket.on('disconnect', (reason: string) => {
            console.log('ChatPage: Socket disconnected. Reason:', reason);
            setIsConnected(false);
             if (reason !== 'io client disconnect' && !opponentLeft) { // Don't show error if opponent already left
                 setNotification('채팅 서버와의 연결이 끊어졌습니다. 재연결을 시도합니다...');
             }
        });

        socket.on('connect_error', (err: Error) => {
             console.error('ChatPage: Socket connection error:', err.message);
             // Avoid setting duplicate errors if already handled by auth check
             if (!error?.includes('인증')) {
                setError(`채팅 서버 연결 오류: ${err.message}`);
             }
             setIsConnected(false);
        });

        // --- Listen for Chat History --- 
        socket.on('chat-history', (history: { senderId: number, text: string, timestamp: number }[]) => {
            console.log('ChatPage: Received chat history:', history);
             if (currentUserId !== null) {
                 // Explicitly type the result of the map to match the Message interface
                 const formattedHistory: Message[] = history.map(msg => ({
                     senderId: msg.senderId,
                     text: msg.text,
                     timestamp: msg.timestamp,
                     sender: msg.senderId === currentUserId ? 'me' : 'other' // Assign 'me' or 'other'
                 }));
                 setMessages(formattedHistory);
                 console.log('ChatPage: Formatted and set chat history.');
             } else {
                  console.warn("Received history but currentUserId is null, cannot format sender.");
                   // Optionally show an error or retry logic?
             }
        });
        // ------------------------------- 

        // Listen for incoming messages
        socket.on('chat message', (message: { senderId: number, text: string, timestamp: number }) => {
             console.log('ChatPage: Received raw message:', message);
             // Ensure currentUserId is available before processing
             if (currentUserId !== null) {
                 const formattedMessage: Message = {
                     senderId: message.senderId,
                     text: message.text,
                     timestamp: message.timestamp,
                     sender: message.senderId === currentUserId ? 'me' : 'other', // Differentiate sender
                 };
                 console.log('ChatPage: Formatted message:', formattedMessage);
                 setMessages((prevMessages) => [...prevMessages, formattedMessage]);
             } else {
                  console.warn("Received message but currentUserId is null, cannot determine sender.");
             }
        });

         // Listen for opponent disconnect/leave event from backend
         socket.on('opponent-left-chat', (data: { userId?: number }) => {
             const opponentId = data?.userId || '상대방';
             console.log(`ChatPage: Opponent left chat (User ID: ${opponentId})`);
             setNotification('상대방이 채팅방을 나갔습니다. 메시지를 보낼 수 없습니다.'); // Use notification state
             setOpponentLeft(true); // Set opponent left state
             setIsConnected(false); // Prevent sending messages
              // DO NOT disconnect socket or redirect automatically
         });

        // Cleanup function
        return () => {
            console.log(`ChatPage: Unmounting/cleanup for matchId: ${matchId}. Disconnecting socket.`);
            if (socketRef.current) {
                 socketRef.current.off('connect');
                 socketRef.current.off('disconnect');
                 socketRef.current.off('connect_error');
                 socketRef.current.off('chat message');
                 socketRef.current.off('opponent-left-chat'); // Make sure to remove the new listener
                 socketRef.current.off('chat-history'); // Remove history listener
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    // Dependencies: run effect if matchId or currentUserId changes
    }, [matchId, currentUserId, router, error]);

    // --- Scroll to bottom when messages change ---
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // --- Send message handler ---
    const handleSendMessage = useCallback((e?: React.FormEvent) => {
        e?.preventDefault();
         if (newMessage.trim() && socketRef.current && isConnected && !opponentLeft && matchId && currentUserId) {
             console.log(`ChatPage: Sending message: "${newMessage}" to matchId: ${matchId}`);
             const messageData = {
                 matchId: matchId,
                 text: newMessage.trim(),
                 // Backend uses socket.user.userId, no need to send senderId from client
             };
              // Optimistically add the message to the UI immediately
              const optimisticMessage: Message = {
                   sender: 'me',
                   senderId: currentUserId, // Include senderId for consistency if needed later
                   text: newMessage.trim(),
                   timestamp: Date.now()
              };
              setMessages((prevMessages) => [...prevMessages, optimisticMessage]);

             socketRef.current.emit('chat message', messageData);
             setNewMessage(''); // Clear input after sending
         }
    }, [newMessage, isConnected, opponentLeft, matchId, currentUserId]); // Added opponentLeft

    // --- Leave Chat Handler ---
    const handleLeaveChat = useCallback(() => {
        if (socketRef.current && matchId) { // Allow leaving even if disconnected
            console.log(`ChatPage: User leaving chat room: ${matchId}`);
            if (isConnected) { // Only emit if still connected
                 socketRef.current.emit('leave-chat-room', matchId);
                 socketRef.current.disconnect(); 
            }
        }
        // Redirect user immediately to main page
        console.log("Redirecting to /main after leaving chat.");
        router.push('/main');
    }, [socketRef, isConnected, matchId, router]); // Added dependencies

    // --- Render Logic ---
     if (!matchId && !error) {
         return <div className={`flex justify-center items-center h-screen bg-gray-900 text-white ${inter.className}`}>매치 ID를 로드하는 중...</div>;
     }
      if (error && !error.includes('연결 오류')) { // Show critical errors like missing ID/Auth prominently
           return (
                <div className={`flex flex-col justify-center items-center h-screen bg-gray-900 text-white ${inter.className}`}>
                    <p className="text-red-500 mb-4">오류: {error}</p>
                    <button onClick={() => router.push('/')} className="mt-2 text-amber-400 underline">로그인 페이지로 이동</button>
                 </div>
            );
       }

    return (
        <div className={`flex flex-col h-screen bg-black text-slate-100 ${inter.className}`}>
            {/* Header */}
            <header className="bg-gray-950 p-4 flex items-center justify-between sticky top-0 z-10 shadow-md">
                <div className="flex items-center">
                    <button onClick={() => router.push('/main')} className="text-slate-100 hover:text-slate-300 mr-3 p-1 rounded-full hover:bg-gray-800">
                         <ArrowLeftIcon className="h-6 w-6" />
                     </button>
                     {/* Replace with actual opponent info if available */}
                     <div className="w-10 h-10 rounded-full mr-3 bg-gray-700 border-2 border-amber-500"></div>
                    <h1 className={`text-lg font-semibold ${montserrat.className}`}>상대방</h1>
                </div>
                 {/* Leave Chat Button (Always available) */} 
                 <button
                    onClick={handleLeaveChat} 
                    className="text-slate-400 hover:text-red-500 p-1 rounded-full hover:bg-gray-800" 
                    title="채팅방 나가기"
                 >
                     <ArrowLeftOnRectangleIcon className="h-6 w-6" />
                 </button>
            </header>

            {/* Message List Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-black">
                {/* Notification Display Area */} 
                {notification && ( 
                    <div className="text-center p-3 my-2 text-sm text-yellow-300 bg-yellow-900 bg-opacity-50 rounded-md"> 
                        {notification}
                    </div>
                )}
                {messages.map((msg, index) => (
                    <div key={`${msg.timestamp}-${index}`} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xs md:max-w-md px-4 py-2 rounded-2xl shadow ${msg.sender === 'me' ? 'bg-amber-600 text-slate-900' : 'bg-gray-800 text-slate-100'}`}> 
                            <p className="text-sm break-words">{msg.text}</p>
                            {/* <span className="text-xs opacity-70 block text-right mt-1">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span> */}
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
                        placeholder={!isConnected ? (notification || "연결 끊김") : opponentLeft ? "상대방이 나갔습니다." : "메시지를 입력하세요..."}
                        className={`flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-full focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-slate-100 placeholder-slate-400 ${inter.className}`}
                        disabled={!isConnected || opponentLeft} // Disable input if not connected OR opponent left
                    />
                    <button
                        type="submit"
                        className={`p-2 rounded-full transition-colors ${newMessage.trim() && isConnected && !opponentLeft ? 'bg-amber-500 hover:bg-amber-600 text-slate-900' : 'bg-gray-700 text-slate-500 cursor-not-allowed'}`}
                        disabled={!newMessage.trim() || !isConnected || opponentLeft} // Disable button if not connected OR opponent left
                    >
                        <PaperAirplaneIcon className="h-6 w-6" />
                    </button>
                </form>
            </div>
        </div>
    );
}

// --- Main Chat Page Component (renders ChatContent) --- 
export default function ChatPage() {
  return (
    <AuthGuard requiredStatus="active">
      <Suspense fallback={<div className="flex justify-center items-center min-h-screen">Loading...</div>}>
        <ChatContent />
      </Suspense>
    </AuthGuard>
  );
} 