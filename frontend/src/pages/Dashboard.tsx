// Hub home: hero + equal 3-column agent card grid.

import { useNavigate } from 'react-router-dom';
import { FileSearch, Newspaper, Database, ArrowRight } from 'lucide-react';
import { agentRegistry } from '../lib/agentRegistry';
import type { AgentMeta } from '../lib/agentRegistry';

const iconMap: Record<string, React.ElementType> = {
  FileSearch,
  Newspaper,
  Database,
};

function AgentCard({ agent }: { agent: AgentMeta }) {
  const navigate = useNavigate();
  const Icon = iconMap[agent.icon] ?? Database;

  return (
    <div
      onClick={() => agent.status === 'active' && navigate(agent.route)}
      className="group border border-[#1e1e1e] bg-[#111111] rounded-[10px] p-6 flex flex-col hover:border-[#2a2a2a] hover:bg-[#131313] transition-all duration-150 cursor-pointer"
    >
      {/* Top row: icon + status pill */}
      <div className="flex items-start justify-between mb-4">
        <Icon
          size={18}
          className="text-[#525252] group-hover:text-amber-400 transition-colors duration-150"
        />
        <span className="bg-[#1a1a1a] border border-[#262626] text-[11px] font-medium tracking-wide px-2 py-0.5 rounded-full">
          {agent.status === 'active' ? (
            <>
              <span className="text-amber-400">●</span>
              <span className="text-[#525252]"> ACTIVE</span>
            </>
          ) : (
            <span className="text-[#525252]">○ SOON</span>
          )}
        </span>
      </div>

      {/* Name */}
      <p className="text-[18px] font-semibold text-[#fafafa] mb-1.5 tracking-tight">
        {agent.name}
      </p>

      {/* Description */}
      <p className="text-[14px] text-[#525252] leading-relaxed mb-5 flex-1">
        {agent.tagline}
      </p>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        {agent.tags.map((tag) => (
          <span
            key={tag}
            className="font-mono bg-[#0f0f0f] border border-[#1e1e1e] text-[#525252] text-[11px] px-2 py-0.5 rounded-[3px]"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* CTA */}
      {agent.status === 'active' && (
        <button
          onClick={(e) => { e.stopPropagation(); navigate(agent.route); }}
          className="w-full h-9 border border-[#262626] text-[#fafafa] text-[14px] font-medium rounded-[6px] flex items-center justify-center gap-2 group-hover:border-amber-400/60 group-hover:text-amber-400 hover:bg-amber-400 hover:text-[#0a0a0a] hover:border-amber-400 transition-all duration-150"
        >
          Open Agent
          <ArrowRight size={14} />
        </button>
      )}
    </div>
  );
}

export default function Dashboard() {
  return (
    <div className="max-w-[1000px] mx-auto px-0 py-4">
      {/* Hero */}
      <div className="mb-12">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-8 bg-amber-400 rounded-full" />
          <span className="text-[12px] font-semibold tracking-[0.12em] uppercase text-amber-400">
            AI Workspace
          </span>
        </div>
        <h1 className="text-[36px] font-bold text-[#fafafa] tracking-tight leading-tight mb-2">
          Welcome to AI Hub.
        </h1>
        <p className="text-[15px] text-[#525252]">
          Your intelligent workspace, ready when you are.
        </p>
      </div>

      {/* Agents section label */}
      <div className="flex items-center gap-4 mb-6">
        <span className="text-[12px] font-semibold tracking-[0.12em] uppercase text-amber-400/60">
          Agents
        </span>
        <div className="flex-1 h-px bg-amber-400/20" />
      </div>

      {/* Equal 3-column grid */}
      <div className="grid grid-cols-3 gap-4">
        {agentRegistry.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>
    </div>
  );
}
