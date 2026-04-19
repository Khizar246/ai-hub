// Outer layout: sidebar + topbar + scrollable main content.

import { useState } from 'react';
import type { ReactNode } from 'react';
import Topbar from './Topbar';
import Sidebar from './Sidebar';

interface ShellProps {
  children: ReactNode;
}

export default function Shell({ children }: ShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-[#0a0a0a] overflow-hidden">
      {/* Static sidebar — tablet (icon rail) + desktop (full) */}
      <div className="hidden md:block shrink-0">
        <Sidebar />
      </div>

      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile drawer sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-72 z-50 md:hidden transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar forceExpanded onClose={() => setSidebarOpen(false)} />
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0a0a] min-w-0">
        <Topbar onMenuClick={() => setSidebarOpen(v => !v)} />
        <main className="flex-1 overflow-y-auto">
          <div className="px-4 md:px-6 lg:px-8 py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
