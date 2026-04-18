// Platform topbar: AI Hub branding, agent breadcrumb, dark mode toggle.

import { useLocation, Link } from 'react-router-dom';
import { Zap, Sun, Moon } from 'lucide-react';
import { useUIStore } from '../../lib/store';
import { getAgent } from '../../lib/agentRegistry';

export default function Topbar() {
  const { darkMode, toggleDarkMode } = useUIStore();
  const location = useLocation();

  // Derive breadcrumb from URL
  const match = location.pathname.match(/^\/agent\/([^/]+)/);
  const agentId = match?.[1];
  const agent = agentId ? getAgent(agentId) : undefined;

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-6 border-b transition-colors ${
        darkMode
          ? 'bg-slate-900 border-slate-800'
          : 'bg-white border-slate-200'
      }`}
    >
      {/* Left: brand + breadcrumb */}
      <div className="flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 via-purple-500 to-emerald-500 flex items-center justify-center shadow-sm">
            <Zap size={14} className="text-white" />
          </div>
          <span
            className={`font-black text-base tracking-tight ${
              darkMode ? 'text-white' : 'text-slate-900'
            }`}
          >
            AI Hub
          </span>
        </Link>

        {agent && (
          <>
            <span className={`text-sm ${darkMode ? 'text-slate-600' : 'text-slate-300'}`}>/</span>
            <span
              className={`text-sm font-semibold ${
                darkMode ? 'text-slate-300' : 'text-slate-600'
              }`}
            >
              {agent.name}
            </span>
          </>
        )}
      </div>

      {/* Right: dark mode toggle */}
      <button
        onClick={toggleDarkMode}
        aria-label="Toggle dark mode"
        className={`p-2 rounded-lg border transition-all ${
          darkMode
            ? 'bg-slate-800 border-slate-700 text-yellow-400 hover:bg-slate-700'
            : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
        }`}
      >
        {darkMode ? <Sun size={16} /> : <Moon size={16} />}
      </button>
    </header>
  );
}
