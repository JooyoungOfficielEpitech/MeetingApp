'use client';

import React, { useEffect, useRef } from 'react';
import { ClockIcon } from '@heroicons/react/24/outline';
import { Inter } from 'next/font/google';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import io, { Socket } from 'socket.io-client';

const inter = Inter({ subsets: ['latin'] });

const secondaryButtonStyle = `inline-flex items-center justify-center px-4 py-2 mt-6 border border-transparent text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black bg-slate-700 hover:bg-slate-600 text-slate-100 focus:ring-amber-500`;

export default function PendingApprovalPage() {
  const router = useRouter();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userStatus = localStorage.getItem('user');

    if (userStatus === 'active') {
      console.log('[Pending Page] Status already active, redirecting to main.');
      router.replace('/main');
      return;
    }
    if (!token) {
      console.log('[Pending Page] No token found, redirecting to login.');
      router.replace('/');
      return;
    }

    if (!socketRef.current) {
        console.log('[Pending Page] Initializing WebSocket connection...');
        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
        socketRef.current = io(socketUrl, { auth: { token } });

        const socket = socketRef.current;

        socket.on('connect', () => { console.log('[Pending Page] WebSocket connected:', socket.id); });
        socket.on('connect_error', (err) => { console.error('[Pending Page] WebSocket connection error:', err.message); });
        socket.on('disconnect', (reason) => { console.log('[Pending Page] WebSocket disconnected:', reason); });

        socket.on('userApproved', (data: { message?: string; token?: string }) => {
            console.log('[Pending Page] Received userApproved event:', data);
            if (data && data.token) {
                alert('Your account has been approved! Redirecting...');
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', 'active');
                router.replace('/main');
            } else {
                console.error('[Pending Page] "userApproved" event received without new token.');
                alert('Approval processed, but session update failed. Please try logging in manually.');
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                localStorage.removeItem('userId');
                localStorage.removeItem('userGender');
                router.push('/');
            }
        });

        socket.on('userRejected', (data: { reason?: string; message?: string }) => {
            console.log('[Pending Page] Received userRejected event:', data);
            const customReason = data?.reason;
            const baseMessage = data?.message || 'Your account registration was rejected.';
            const finalMessage = customReason ? `${baseMessage}\n\nReason: ${customReason}` : baseMessage;
            alert(finalMessage);
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('userId');
            localStorage.removeItem('userGender');
            socket.disconnect();
            socketRef.current = null;
            router.push('/');
        });

        // ★ Listen for profile rejection ★
        socket.on('profileRejected', (data: { reason?: string; message?: string }) => {
            console.log('[Pending Page] Received profileRejected event:', data);
            const reason = data?.reason || 'No specific reason provided.';
            const message = data?.message || 'Your profile submission was rejected.';
            alert(`${message}\n\nReason: ${reason}\n\nYou will be redirected to update your profile.`);
            // ★ Store reason in sessionStorage before redirecting ★
            sessionStorage.setItem('profileRejectionReason', reason); 
            // Disconnect socket before redirecting
            socket.disconnect();
            socketRef.current = null;
            // Redirect to profile completion page
            router.push('/signup/complete-profile'); // ★ Redirect to profile update page
        });
    }

    return () => {
        if (socketRef.current && socketRef.current.connected) {
            console.log('[Pending Page] Disconnecting WebSocket.');
            socketRef.current.disconnect();
            socketRef.current = null;
        }
    };

  }, [router]);

  return (
    <div className={`min-h-screen flex items-center justify-center bg-black text-slate-100 ${inter.className}`}>
      <div className="text-center p-8 bg-gray-950 rounded-xl shadow-lg max-w-md mx-auto">
        <ClockIcon className="h-16 w-16 text-amber-500 mx-auto mb-6" />
        <h1 className="text-2xl font-bold text-slate-100 mb-4">Account Pending Approval</h1>
        <p className="text-slate-400 mb-6">
          Your account registration is complete, but it requires administrator approval before you can access the application.
        </p>
        <p className="text-slate-400">
          You can check back later by trying to log in again.
        </p>
        <Link href="/" legacyBehavior>
            <a className={secondaryButtonStyle}>
                Return to Login
            </a>
        </Link>
      </div>
    </div>
  );
} 