// Agent navigation sidebar: reads agentRegistry, highlights active route.

import { useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import {
  FileSearch, Newspaper, Database, LayoutDashboard,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { agentRegistry } from '../../lib/agentRegistry';
import { useUIStore } from '../../lib/store';

const iconMap: Record<string, React.ReactNode> = {
  FileSearch:  <FileSearch size={16} />,
  Newspaper:   <Newspaper size={16} />,
  Database:    <Database size={16} />,
};

const colorMap: Record<string, string> = {
  blue:    'bg-blue-600 shadow-blue-600/30',
  emerald: 'bg-emerald-500 shadow-emerald-500/30',
  purple:  'bg-purple-600 shadow-purple-600/30',
};

const activeBorderMap: Record<string, string> = {
  blue:    'border-blue-600',
  emerald: 'border-emerald-500',
  purple:  'border-purple-600',
};

export default function Sidebar() {
  const { darkMode } = useUIStore();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const width = collapsed ? 'w-[60px]' : 'w-[240px]';

  return (
    <aside
      className={`fixed top-14 left-0 bottom-0 z-40 flex flex-col border-r transition-all duration-200 ${width} ${
        darkMode
          ? 'bg-slate-900 border-slate-800'
          : 'bg-white border-slate-200'
      }`}
    >
      {/* Dashboard link */}
      <div className="px-3 pt-4 pb-2">
        <Link
          to="/"
          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors ${
            location.pathname === '/'
              ? darkMode
                ? 'bg-slate-800 text-white'
                : 'bg-slate-100 text-slate-900'
              : darkMode
              ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <LayoutDashboard size={16} className="shrink-0" />
          {!collapsed && <span>Dashboard</span>}
        </Link>
      </div>

      <div className={`px-3 mb-2 ${!collapsed ? '' : 'hidden'}`}>
        <p className={`text-[9px] font-black uppercase tracking-widest px-3 ${
          darkMode ? 'text-slate-600' : 'text-slate-400'
        }`}>
          Agents
        </p>
      </div>

      {/* Agent nav items */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {agentRegistry.map((agent) => {
          const isActive = location.pathname.startsWith(`/agent/${agent.id}`);
          return (
            <NavLink
              key={agent.id}
              to={agent.route}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                isActive
                  ? darkMode
                    ? `bg-slate-800 text-white border-l-2 ${activeBorderMap[agent.color]} border-t-0 border-r-0 border-b-0`
                    : `bg-slate-50 text-slate-900 border-l-2 ${activeBorderMap[agent.color]} border-t-0 border-r-0 border-b-0`
                  : `border-transparent ${
                      darkMode
                        ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`
              }`}
            >
              <div
                className={`w-6 h-6 rounded-lg flex items-center justify-center text-white shrink-0 shadow-md ${
                  colorMap[agent.color] ?? 'bg-slate-500'
                }`}
              >
                {iconMap[agent.icon] ?? <Database size={14} />}
              </div>

              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <p className="truncate leading-none">{agent.name}</p>
                  {agent.status === 'coming-soon' && (
                    <span className={`text-[8px] font-black uppercase tracking-widest ${
                      darkMode ? 'text-slate-600' : 'text-slate-400'
                    }`}>
                      coming soon
                    </span>
                  )}
                </div>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="px-3 py-4 border-t border-inherit">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`w-full flex items-center justify-center p-2 rounded-xl transition-colors ${
            darkMode
              ? 'text-slate-600 hover:text-slate-400 hover:bg-slate-800'
              : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
          }`}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>
    </aside>
  );
}
