// Platform topbar: breadcrumb navigation + mobile menu toggle.

import { useLocation, Link } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { getAgent } from '../../lib/agentRegistry';

interface TopbarProps {
  onMenuClick: () => void;
}

export default function Topbar({ onMenuClick }: TopbarProps) {
  const location = useLocation();

  const match = location.pathname.match(/^\/agent\/([^/]+)/);
  const agentId = match?.[1];
  const agent = agentId ? getAgent(agentId) : undefined;

  return (
    <header className="h-12 border-b border-[#262626] bg-[#0a0a0a] flex items-center px-4 md:px-6 shrink-0">
      {/* Hamburger — mobile only */}
      <button
        onClick={onMenuClick}
        className="h-11 w-11 flex items-center justify-center text-[#525252] hover:text-[#a3a3a3] transition-colors md:hidden -ml-2 mr-1 shrink-0"
        aria-label="Open navigation menu"
      >
        <Menu size={20} />
      </button>

      <div className="flex items-center gap-2">
        <Link
          to="/"
          className="text-[15px] font-semibold text-[#fafafa] tracking-tight hover:text-white transition-colors duration-150"
        >
          AI Hub
        </Link>

        {agent && (
          <>
            <span className="text-[#525252] text-sm mx-1">/</span>
            <span className="text-[#525252] text-sm truncate max-w-[160px] md:max-w-none">{agent.name}</span>
          </>
        )}
      </div>
    </header>
  );
}
