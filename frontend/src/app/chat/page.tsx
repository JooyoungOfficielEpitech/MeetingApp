'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon, PaperAirplaneIcon, ArrowLeftOnRectangleIcon } from '@heroicons/react/24/solid';
import { Montserrat, Inter } from 'next/font/google';

// Initialize fonts
const montserrat = Montserrat({ subsets: ['latin'], weight: ['600', '700'] });
const inter = Inter({ subsets: ['latin'] });

// Interface for messages
interface Message {
  id: string;
  text: string;
  sender: 'me' | 'other';
  timestamp: number;
}

// Mock data for the other user (replace with actual data fetching)
const mockOtherUser = {
  name: 'Sumin',
  profileImageUrl: 'https://via.placeholder.com/40',
};

// Note: This component should be in `app/chat/[chatId]/page.tsx`
export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Mock message loading and adding new messages
  useEffect(() => {
    // Initial mock messages
    setMessages([
      { id: '1', text: 'Hello there!', sender: 'other', timestamp: Date.now() - 20000 },
      { id: '2', text: 'Hi Sumin! Nice to meet you.', sender: 'me', timestamp: Date.now() - 10000 },
      { id: '3', text: 'Nice to meet you too! How are you?', sender: 'other', timestamp: Date.now() - 5000 },
    ]);

    // Simulate receiving a new message after a delay (for demo)
    const timer = setTimeout(() => {
      setMessages(prev => [...prev, { id: '4', text: 'I\'m doing well, thanks for asking!', sender: 'me', timestamp: Date.now() }]);
    }, 7000);

    return () => clearTimeout(timer);
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = useCallback((e?: React.FormEvent) => {
    e?.preventDefault(); // Prevent form submission if used in a form
    if (newMessage.trim() === '') return;

    const messageToSend: Message = {
      id: String(Date.now()), // Simple unique ID for mock
      text: newMessage,
      sender: 'me',
      timestamp: Date.now(),
    };
    console.log('Mock API Call: Sending message:', messageToSend); // Log added
    setMessages(prev => [...prev, messageToSend]);
    setNewMessage('');

    // Simulate other user replying after a short delay
    setTimeout(() => {
        console.log('Mock: Simulating reply from other user.'); // Log added
        setMessages(prev => [...prev, {
            id: String(Date.now() + 1),
            text: 'Okay, got it!', // Mock reply
            sender: 'other',
            timestamp: Date.now(),
        }]);
    }, 1500);

  }, [newMessage]);

  const handleLeaveChat = () => {
    console.log(`Mock API Call: User leaving chat with ${mockOtherUser.name}`); // Log leaving action
    // Simulate notification for the other user and their subsequent action
    alert(`(Mock Notification for Other User) \n\n${mockOtherUser.name} has left the chat. \n\nPress OK to return to the main screen.`);
    // Redirect the current user to the main page
    router.push('/main');
  };

  return (
    <div className={`flex flex-col h-screen bg-black text-slate-100 ${inter.className}`}> {/* Full height, Black bg, Inter font */}
      {/* Chat Header */}
      <header className="bg-gray-950 p-4 flex items-center justify-between sticky top-0 z-10 shadow-md"> {/* Use justify-between */}
        <div className="flex items-center"> {/* Group back button, image, name */}
          <button onClick={() => router.back()} className="text-slate-100 hover:text-slate-300 mr-3 p-1 rounded-full hover:bg-gray-800">
            <ArrowLeftIcon className="h-6 w-6" />
          </button>
          <img src={mockOtherUser.profileImageUrl} alt={mockOtherUser.name} className="w-10 h-10 rounded-full mr-3 border-2 border-amber-500" />
          <h1 className={`text-lg font-semibold ${montserrat.className}`}>{mockOtherUser.name}</h1> {/* Montserrat font */}
        </div>
        {/* Leave Chat Button with new icon */}
        <button
          onClick={handleLeaveChat}
          className="text-slate-400 hover:text-amber-500 p-1 rounded-full hover:bg-gray-800"
          title="Leave Chat" // Tooltip remains accurate
        >
          <ArrowLeftOnRectangleIcon className="h-6 w-6" /> {/* Changed icon */}
        </button>
      </header>

      {/* Message List Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-black"> {/* Message area takes remaining space */}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xs md:max-w-md px-4 py-2 rounded-2xl ${msg.sender === 'me' ? 'bg-amber-600 text-slate-900' : 'bg-gray-800 text-slate-100'}`}> {/* Sender/Receiver styles */}
              <p className="text-sm">{msg.text}</p>
              {/* Optional: Timestamp */}
              {/* <span className="text-xs opacity-70 block text-right mt-1">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span> */}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} /> {/* Element to scroll to */}
      </div>

      {/* Message Input Area */}
      <div className="bg-gray-950 p-4 sticky bottom-0 border-t border-gray-800"> {/* Dark gray bg, border */}
        <form onSubmit={handleSendMessage} className="flex items-center gap-3">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            className={`flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-full focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-slate-100 placeholder-slate-400 ${inter.className}`} // Input styles
          />
          <button
            type="submit"
            className={`p-2 rounded-full transition-colors ${newMessage.trim() ? 'bg-amber-500 hover:bg-amber-600 text-slate-900' : 'bg-gray-700 text-slate-500 cursor-not-allowed'}`} // Submit button styles, disabled state
            disabled={!newMessage.trim()}
          >
            <PaperAirplaneIcon className="h-6 w-6" />
          </button>
        </form>
      </div>
    </div>
  );
} 