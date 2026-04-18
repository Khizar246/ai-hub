// Hub home page: hero section + agent cards grid mapped from agentRegistry.

import { useNavigate } from 'react-router-dom';
import {
  FileSearch, Newspaper, Database, Zap, ArrowRight,
} from 'lucide-react';
import { agentRegistry } from '../lib/agentRegistry';
import type { AgentMeta } from '../lib/agentRegistry';
import { useUIStore } from '../lib/store';
import Badge from '../components/ui/Badge';

const iconMap: Record<string, React.ReactNode> = {
  FileSearch: <FileSearch size={22} />,
  Newspaper:  <Newspaper size={22} />,
  Database:   <Database size={22} />,
};

const colorMap: Record<string, { icon: string; ring: string; btn: string; tag: string }> = {
  blue: {
    icon: 'bg-blue-600 shadow-blue-600/30',
    ring: 'group-hover:ring-blue-200 dark:group-hover:ring-blue-900',
    btn:  'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20',
    tag:  'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
  },
  emerald: {
    icon: 'bg-emerald-500 shadow-emerald-500/30',
    ring: 'group-hover:ring-emerald-200 dark:group-hover:ring-emerald-900',
    btn:  'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20',
    tag:  'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
  },
  purple: {
    icon: 'bg-purple-600 shadow-purple-600/30',
    ring: 'group-hover:ring-purple-200 dark:group-hover:ring-purple-900',
    btn:  'bg-purple-600 hover:bg-purple-700 shadow-purple-600/20',
    tag:  'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800',
  },
};

function AgentCard({ agent }: { agent: AgentMeta }) {
  const { darkMode } = useUIStore();
  const navigate = useNavigate();
  const colors = colorMap[agent.color] ?? colorMap.blue;

  return (
    <div
      className={`group relative rounded-[2rem] border p-8 flex flex-col gap-6 transition-all duration-200
        ring-4 ring-transparent ${colors.ring} cursor-pointer ${
        darkMode
          ? 'bg-slate-800 border-slate-700 hover:border-slate-600'
          : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-lg'
      }`}
      onClick={() => agent.status === 'active' && navigate(agent.route)}
    >
      {/* Status badge — top right */}
      <div className="absolute top-6 right-6">
        <Badge variant={agent.status === 'active' ? 'active' : 'coming-soon'}>
          {agent.status === 'active' ? 'Active' : 'Coming soon'}
        </Badge>
      </div>

      {/* Icon */}
      <div
        className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg ${colors.icon}`}
      >
        {iconMap[agent.icon] ?? <Database size={22} />}
      </div>

      {/* Text */}
      <div className="flex-1 space-y-2">
        <h3
          className={`text-lg font-black leading-tight ${
            darkMode ? 'text-white' : 'text-slate-900'
          }`}
        >
          {agent.name}
        </h3>
        <p
          className={`text-sm leading-relaxed ${
            darkMode ? 'text-slate-400' : 'text-slate-500'
          }`}
        >
          {agent.tagline}
        </p>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5">
        {agent.tags.map((tag) => (
          <span
            key={tag}
            className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${colors.tag}`}
          >
            {tag}
          </span>
        ))}
      </div>

      {/* CTA */}
      {agent.status === 'active' && (
        <button
          className={`flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-sm font-black text-white shadow-lg transition-all ${colors.btn}`}
          onClick={(e) => {
            e.stopPropagation();
            navigate(agent.route);
          }}
        >
          Open Agent
          <ArrowRight size={14} />
        </button>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { darkMode } = useUIStore();

  return (
    <div className="max-w-5xl mx-auto space-y-12">
      {/* Hero */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 via-purple-500 to-emerald-500 flex items-center justify-center shadow-lg">
            <Zap size={20} className="text-white" />
          </div>
          <div>
            <h1
              className={`text-3xl font-black tracking-tight ${
                darkMode ? 'text-white' : 'text-slate-900'
              }`}
            >
              AI Hub
            </h1>
            <p
              className={`text-xs font-bold uppercase tracking-widest ${
                darkMode ? 'text-slate-500' : 'text-slate-400'
              }`}
            >
              Unified AI Platform
            </p>
          </div>
        </div>
        <p
          className={`text-base max-w-xl leading-relaxed ${
            darkMode ? 'text-slate-400' : 'text-slate-600'
          }`}
        >
          Three intelligent agents — document compliance, news research, and natural-language
          database querying — in a single platform.
        </p>
      </div>

      {/* Agent cards grid */}
      <div>
        <p
          className={`text-[10px] font-black uppercase tracking-widest mb-4 ${
            darkMode ? 'text-slate-600' : 'text-slate-400'
          }`}
        >
          Available agents
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {agentRegistry.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      </div>
    </div>
  );
}
