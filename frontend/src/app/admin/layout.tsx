'use client';

import React, { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HomeIcon, UsersIcon, LinkIcon } from '@heroicons/react/24/outline';

interface NavItemProps {
  icon: React.ElementType;
  label: string;
  href: string;
  isActive: boolean;
}

const BottomNavItem = ({ icon: Icon, label, href, isActive }: NavItemProps) => (
  <Link href={href} legacyBehavior>
    <a
      className={`flex flex-col items-center flex-1 py-2 px-1 rounded-lg transition-colors duration-200 ${
        isActive
          ? 'text-indigo-400'
          : 'text-gray-400 hover:bg-gray-700 hover:text-white'
      }`}
      title={label}
    >
      <Icon className="h-6 w-6 mb-1" />
      <span className="text-xs font-medium">{label}</span>
    </a>
  </Link>
);

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 z-10">
        <div className="flex justify-around items-center max-w-3xl mx-auto px-2 py-1">
          <BottomNavItem
            icon={HomeIcon}
            label="Dashboard"
            href="/admin"
            isActive={pathname === '/admin'}
          />
          <BottomNavItem
            icon={UsersIcon}
            label="Tier Management"
            href="/admin/tier"
            isActive={pathname === '/admin/tier'}
          />
          <BottomNavItem
            icon={LinkIcon}
            label="Invite Links"
            href="/admin/links"
            isActive={pathname === '/admin/links'}
          />
        </div>
      </nav>
    </div>
  );
} 