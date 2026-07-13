'use client';

import { useState } from 'react';
import { DashboardContent } from './DashboardContent';
import { DashboardHeader } from './DashboardHeader';
import { SidebarNav } from './SidebarNav';

export function PlatformShell() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div dir="rtl" className="min-h-screen bg-[radial-gradient(circle_at_top,_#f8fbff,_#f2f5f9_55%,_#eef2f7)] text-slate-900">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
        <DashboardHeader onMenuToggle={() => setMobileMenuOpen(value => !value)} mobileMenuOpen={mobileMenuOpen} />

        <div className="flex flex-col gap-6 lg:flex-row">
          <main className="flex-1">
            <DashboardContent />
          </main>
          <div className="hidden lg:block">
            <SidebarNav />
          </div>
        </div>
      </div>
    </div>
  );
}
