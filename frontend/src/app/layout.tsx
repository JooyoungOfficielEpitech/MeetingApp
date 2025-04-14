'use client'; // Make layout a client component for useEffect and useRouter

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { usePathname, useRouter } from 'next/navigation'; // Import hooks
import { useEffect } from 'react'; // Import useEffect

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// --- No static metadata in client components --- 
// export const metadata: Metadata = {
//   title: 'Create Next App',
//   description: 'Generated by create next app',
// };
// ------------------------------------------------

// --- Auth and Status Check Logic (Simplified) --- 
function AuthStatusRedirect({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const token = localStorage.getItem('token');
    console.log(`[Layout Check] Path: ${pathname}, Token: ${!!token}`);

    // Define paths accessible without login
    const publicPaths = ['/', '/signup', '/auth/callback', '/auth/pending-approval', '/signup/complete-profile']; // Added pending-approval and complete-profile
    const isPublicPath = publicPaths.includes(pathname);

    // If user is not logged in and trying to access a non-public page, redirect to login
    if (!token && !isPublicPath) {
       console.log('[Layout Check] No token and not public path, redirecting to login.');
       router.replace('/');
    }

    // Remove other complex status checks and redirects from layout
    // Status checking will now happen primarily during login attempt

  }, [pathname, router]);

  return <>{children}</>;
}
// -----------------------------------

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Wrap children with the auth/status checker */}
        <AuthStatusRedirect>{children}</AuthStatusRedirect>
      </body>
    </html>
  );
}
