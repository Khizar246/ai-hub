// Platform topbar: breadcrumb navigation.

import { useLocation, Link } from 'react-router-dom';
import { getAgent } from '../../lib/agentRegistry';

export default function Topbar() {
  const location = useLocation();

  const match = location.pathname.match(/^\/agent\/([^/]+)/);
  const agentId = match?.[1];
  const agent = agentId ? getAgent(agentId) : undefined;

  return (
    <header className="h-12 border-b border-[#262626] bg-[#0a0a0a] flex items-center px-6 shrink-0">
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
            <span className="text-[#525252] text-sm">{agent.name}</span>
          </>
        )}
      </div>
    </header>
  );
}
