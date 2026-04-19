// Agent navigation sidebar: text-only nav with amber left-border accent on active item.

import { useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { FileSearch, Newspaper, Database, LayoutDashboard, User } from 'lucide-react';
import { agentRegistry } from '../../lib/agentRegistry';
import ContactFloat from '../ui/ContactFloat';

const iconMap: Record<string, React.ElementType> = {
  FileSearch,
  Newspaper,
  Database,
};

export default function Sidebar() {
  const location = useLocation();
  const [contactOpen, setContactOpen] = useState(false);

  const inactiveItem =
    'flex items-center gap-2.5 px-2 py-1.5 rounded-[4px] text-[14px] font-medium text-[#525252] hover:text-[#a3a3a3] hover:bg-[#111111] transition-colors duration-100 cursor-pointer';
  const activeItem =
    'flex items-center gap-2.5 px-[6px] py-1.5 rounded-[4px] text-[14px] font-medium text-[#fafafa] border-l-2 border-amber-400 bg-[#111111]';

  return (
    <>
      <aside className="w-[220px] h-full bg-[#0a0a0a] border-r border-[#1a1a1a] flex flex-col shrink-0">
        {/* Logo section */}
        <div className="h-12 border-b border-[#1a1a1a] px-5 flex items-center shrink-0">
          <div className="w-5 h-5 bg-amber-400 rounded-sm flex items-center justify-center text-black text-xs font-bold shrink-0">
            A
          </div>
          <span className="ml-2.5 text-[14px] font-semibold text-[#fafafa]">AI Hub</span>
        </div>

        {/* Nav section */}
        <div className="flex-1 px-3 pt-4 overflow-y-auto">
          {/* Dashboard */}
          <p className="text-[11px] font-semibold tracking-[0.1em] uppercase text-[#525252] px-2 mb-1">
            General
          </p>
          <Link
            to="/"
            className={location.pathname === '/' ? activeItem : inactiveItem}
          >
            <LayoutDashboard size={14} className="shrink-0" />
            Dashboard
          </Link>

          {/* Agents */}
          <p className="text-[11px] font-semibold tracking-[0.1em] uppercase text-[#525252] px-2 mb-1 mt-5">
            Agents
          </p>
          <nav className="space-y-0.5">
            {agentRegistry.map((agent) => {
              const isActive = location.pathname.startsWith(`/agent/${agent.id}`);
              const Icon = iconMap[agent.icon] ?? Database;
              return (
                <NavLink
                  key={agent.id}
                  to={agent.route}
                  className={isActive ? activeItem : inactiveItem}
                >
                  <Icon size={14} className="shrink-0" />
                  <span className="truncate">{agent.name}</span>
                  {agent.status === 'coming-soon' && (
                    <span className="ml-auto text-[10px] font-medium text-[#525252] tracking-wide">
                      soon
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* About Me */}
        <div className="border-t border-[#1a1a1a] p-3 shrink-0">
          <button
            onClick={() => setContactOpen((v) => !v)}
            className={`w-full ${contactOpen ? activeItem : inactiveItem}`}
          >
            <User size={14} className="shrink-0" />
            About Me
          </button>
        </div>
      </aside>

      <ContactFloat open={contactOpen} onClose={() => setContactOpen(false)} />
    </>
  );
}
