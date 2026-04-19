// Agent navigation sidebar.
// Responsive: icon-only rail on tablet (md), full labels on desktop (lg).
// forceExpanded=true: always full labels (used for mobile drawer).

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

interface SidebarProps {
  forceExpanded?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ forceExpanded = false, onClose }: SidebarProps) {
  const location = useLocation();
  const [contactOpen, setContactOpen] = useState(false);

  // Sidebar width
  const sidebarWidth = forceExpanded ? 'w-[220px]' : 'w-16 lg:w-[220px]';

  // Logo header area
  const logoAreaClass = forceExpanded
    ? 'h-12 border-b border-[#1a1a1a] px-5 flex items-center shrink-0'
    : 'h-12 border-b border-[#1a1a1a] px-2 lg:px-5 flex items-center justify-center lg:justify-start shrink-0';

  // Nav section padding
  const navPadding = forceExpanded ? 'px-3' : 'px-2 lg:px-3';

  // Section label (General / Agents)
  const sectionLabelClass = forceExpanded
    ? 'text-[11px] font-semibold tracking-[0.1em] uppercase text-[#525252] px-2 mb-1'
    : 'hidden lg:block text-[11px] font-semibold tracking-[0.1em] uppercase text-[#525252] px-2 mb-1';

  // Nav item layout tokens
  const itemBase = 'flex items-center py-1.5 rounded-[4px] text-[14px] font-medium transition-colors duration-100';
  const expandedLayout = 'gap-2.5 justify-start';
  const responsiveLayout = 'justify-center lg:justify-start lg:gap-2.5';

  const inactiveItem = forceExpanded
    ? `${itemBase} ${expandedLayout} px-2 text-[#525252] hover:text-[#a3a3a3] hover:bg-[#111111] cursor-pointer`
    : `${itemBase} ${responsiveLayout} lg:px-2 text-[#525252] hover:text-[#a3a3a3] hover:bg-[#111111] cursor-pointer`;

  const activeItem = forceExpanded
    ? `${itemBase} ${expandedLayout} px-[6px] text-[#fafafa] border-l-2 border-amber-400 bg-[#111111]`
    : `${itemBase} ${responsiveLayout} lg:px-[6px] text-[#fafafa] border-l-2 border-amber-400 bg-[#111111]`;

  // Text label visibility
  const labelClass = forceExpanded ? 'truncate' : 'hidden lg:block truncate';

  // Footer padding
  const footerPadding = forceExpanded ? 'p-3' : 'p-2 lg:p-3';

  const handleNavClick = () => onClose?.();

  return (
    <>
      <aside className={`${sidebarWidth} h-full bg-[#0a0a0a] border-r border-[#1a1a1a] flex flex-col shrink-0 transition-[width] duration-300`}>
        {/* Logo */}
        <div className={logoAreaClass}>
          <div className="w-5 h-5 bg-amber-400 rounded-sm flex items-center justify-center text-black text-xs font-bold shrink-0">
            A
          </div>
          <span className={`ml-2.5 text-[14px] font-semibold text-[#fafafa] ${forceExpanded ? '' : 'hidden lg:block'}`}>
            AI Hub
          </span>
        </div>

        {/* Nav */}
        <div className={`flex-1 ${navPadding} pt-4 overflow-y-auto`}>
          <p className={sectionLabelClass}>General</p>
          <Link
            to="/"
            title={forceExpanded ? undefined : 'Dashboard'}
            className={location.pathname === '/' ? activeItem : inactiveItem}
            onClick={handleNavClick}
          >
            <LayoutDashboard size={14} className="shrink-0" />
            <span className={labelClass}>Dashboard</span>
          </Link>

          <p className={`${sectionLabelClass} mt-5`}>Agents</p>
          <nav className="space-y-0.5">
            {agentRegistry.map((agent) => {
              const isActive = location.pathname.startsWith(`/agent/${agent.id}`);
              const Icon = iconMap[agent.icon] ?? Database;
              return (
                <NavLink
                  key={agent.id}
                  to={agent.route}
                  title={forceExpanded ? undefined : agent.name}
                  className={isActive ? activeItem : inactiveItem}
                  onClick={handleNavClick}
                >
                  <Icon size={14} className="shrink-0" />
                  <span className={labelClass}>{agent.name}</span>
                  {agent.status === 'coming-soon' && (
                    <span className={`text-[10px] font-medium text-[#525252] tracking-wide ${forceExpanded ? 'ml-auto' : 'hidden lg:block lg:ml-auto'}`}>
                      soon
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* About Me */}
        <div className={`border-t border-[#1a1a1a] ${footerPadding} shrink-0`}>
          <button
            title={forceExpanded ? undefined : 'About Me'}
            onClick={() => setContactOpen(v => !v)}
            className={`w-full ${contactOpen ? activeItem : inactiveItem}`}
          >
            <User size={14} className="shrink-0" />
            <span className={labelClass}>About Me</span>
          </button>
        </div>
      </aside>

      <ContactFloat open={contactOpen} onClose={() => setContactOpen(false)} />
    </>
  );
}
