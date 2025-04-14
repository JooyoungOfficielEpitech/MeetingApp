'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axiosInstance from '@/utils/axiosInstance';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

// Interface for the chat message data from backend
interface ChatMessage {
    id: number; // Or string, depending on your Message model ID type
    matchId: string;
    senderId: number;
    text: string;
    createdAt: string;
    Sender: { // Assuming the include alias was 'Sender'
        id: number;
        name: string;
        gender: string | null;
    };
}

export default function AdminChatHistoryPage() {
    const params = useParams();
    const router = useRouter();
    const matchId = params.matchId as string; // Get matchId from URL params

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [user1Id, setUser1Id] = useState<number | null>(null);

    const fetchMessages = useCallback(async () => {
        if (!matchId) {
            setError('Match ID not found in URL.');
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);
        console.log(`[Admin Chat Page] Fetching messages for match: ${matchId}`);

        try {
            const response = await axiosInstance.get<ChatMessage[]>(`/api/admin/chats/${matchId}/messages`);
            console.log(`[Admin Chat Page] Fetched ${response.data.length} messages.`);
            setMessages(response.data);

            if (response.data.length > 0) {
                setUser1Id(response.data[0].senderId);
            }

        } catch (err: any) {
            console.error(`[Admin Chat Page] Error fetching messages for match ${matchId}:`, err);
            setError(err.response?.data?.message || `Failed to load messages for match ${matchId}.`);
            if (err.response?.status === 404) {
                 setError(`Match not found or no messages available for match ID: ${matchId}`);
            }
        } finally {
            setIsLoading(false);
        }
    }, [matchId]);

    useEffect(() => {
        fetchMessages();
    }, [fetchMessages]);

    // Helper to format date
    const formatDate = (dateString: string) => {
        try {
            return new Date(dateString).toLocaleString(undefined, {
                year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
            });
        } catch {
            return 'Invalid Date';
        }
    };

    const getNameColorClass = (gender: string | null): string => {
        if (gender === 'male') {
            return 'text-blue-400'; 
        } else if (gender === 'female') {
            return 'text-red-400'; 
        } else {
            return 'text-slate-300'; // Default color slightly different
        }
    };

    return (
        <div className={`p-6 md:p-10 bg-gray-900 min-h-screen text-slate-100 ${inter.className}`}>
            <div className="max-w-3xl mx-auto">
                {/* Back Button */}
                <button
                    onClick={() => router.back()}
                    className="mb-6 inline-flex items-center px-3 py-1.5 text-sm rounded-md bg-slate-700 hover:bg-slate-600 text-slate-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-amber-500"
                >
                    <ArrowLeftIcon className="h-4 w-4 mr-2" />
                    Back to Dashboard
                </button>

                <h1 className="text-2xl font-bold mb-2">Chat History</h1>
                <p className="text-sm text-slate-400 mb-6">Match ID: {matchId}</p>

                {isLoading && (
                    <div className="text-center py-10">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-500 mx-auto mb-4"></div>
                        Loading messages...
                    </div>
                )}

                {error && (
                    <div className="p-4 bg-red-900/50 border border-red-700 text-red-200 rounded-md text-center">
                        Error: {error}
                    </div>
                )}

                {!isLoading && !error && (
                    <div className="flex flex-col space-y-2 bg-gray-800 p-4 rounded-lg shadow-inner" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                        {messages.length > 0 ? (
                            messages.map((msg) => {
                                const isUser1 = msg.senderId === user1Id;
                                const alignmentClass = isUser1 ? 'justify-start' : 'justify-end';
                                const bgColorClass = isUser1 ? 'bg-slate-700' : 'bg-indigo-800';
                                const nameColorClass = getNameColorClass(msg.Sender?.gender);

                                return (
                                    <div key={msg.id} className={`flex w-full ${alignmentClass}`}>
                                        <div className={`p-3 rounded-lg max-w-[80%] ${bgColorClass}`}>
                                            <p className={`text-xs font-semibold mb-1 ${nameColorClass}`}>{msg.Sender?.name || `User ${msg.senderId}`}</p>
                                            <p className="text-sm text-white">{msg.text}</p>
                                            <p className="text-xs text-slate-400 mt-1 text-right">{formatDate(msg.createdAt)}</p>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <p className="text-center text-slate-500 py-6">No messages found for this match.</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}