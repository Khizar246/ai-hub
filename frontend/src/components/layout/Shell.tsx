// Outer layout: sidebar + topbar + scrollable main content.

import type { ReactNode } from 'react';
import Topbar from './Topbar';
import Sidebar from './Sidebar';

interface ShellProps {
  children: ReactNode;
}

export default function Shell({ children }: ShellProps) {
  return (
    <div className="flex h-screen bg-[#0a0a0a] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0a0a]">
        <Topbar />
        <main className="flex-1 overflow-y-auto">
          <div className="px-8 py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
