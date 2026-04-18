// Outer layout: fixed Topbar + fixed Sidebar + scrollable main content.

import type { ReactNode } from 'react';
import Topbar from './Topbar';
import Sidebar from './Sidebar';
import { useUIStore } from '../../lib/store';

interface ShellProps {
  children: ReactNode;
}

export default function Shell({ children }: ShellProps) {
  const { darkMode } = useUIStore();

  return (
    <div
      className={`min-h-screen transition-colors duration-200 ${
        darkMode ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-900'
      }`}
    >
      <Topbar />
      <Sidebar />

      {/* Main content: offset for topbar (56px) and sidebar (240px) */}
      <main className="pt-14 pl-[240px] min-h-screen transition-all duration-200">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
