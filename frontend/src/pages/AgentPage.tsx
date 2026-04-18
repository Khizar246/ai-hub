// Generic agent page: header + collapsible how-it-works + instructions + agent UI.

import { useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import {
  FileSearch, Newspaper, Database,
  ChevronDown, ChevronUp, Info, BookOpen,
} from 'lucide-react';
import { getAgent } from '../lib/agentRegistry';
import { useUIStore } from '../lib/store';
import AuditAgent from '../agents/audit/AuditAgent';
import NewsAgent from '../agents/news/NewsAgent';
import DataAgent from '../agents/data/DataAgent';

const iconMap: Record<string, React.ReactNode> = {
  FileSearch: <FileSearch size={20} />,
  Newspaper:  <Newspaper size={20} />,
  Database:   <Database size={20} />,
};

const agentColorMap: Record<string, { icon: string; accent: string }> = {
  blue:    { icon: 'bg-blue-600 shadow-blue-600/30',    accent: 'text-blue-500' },
  emerald: { icon: 'bg-emerald-500 shadow-emerald-500/30', accent: 'text-emerald-500' },
  purple:  { icon: 'bg-purple-600 shadow-purple-600/30',  accent: 'text-purple-500' },
};

const agentComponents: Record<string, React.ReactNode> = {
  audit: <AuditAgent />,
  news:  <NewsAgent />,
  data:  <DataAgent />,
};

function Accordion({
  title,
  icon,
  children,
  darkMode,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  darkMode: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={`rounded-2xl border overflow-hidden ${
        darkMode ? 'border-slate-700' : 'border-slate-200'
      }`}
    >
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between px-5 py-4 text-left transition-colors ${
          darkMode
            ? 'bg-slate-800 hover:bg-slate-700'
            : 'bg-white hover:bg-slate-50'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className={darkMode ? 'text-slate-400' : 'text-slate-500'}>{icon}</span>
          <span
            className={`text-sm font-black ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}
          >
            {title}
          </span>
        </div>
        {open ? (
          <ChevronUp size={14} className={darkMode ? 'text-slate-500' : 'text-slate-400'} />
        ) : (
          <ChevronDown size={14} className={darkMode ? 'text-slate-500' : 'text-slate-400'} />
        )}
      </button>

      {open && (
        <div
          className={`px-5 pb-5 pt-3 border-t text-sm leading-relaxed ${
            darkMode
              ? 'border-slate-700 bg-slate-900/40 text-slate-400'
              : 'border-slate-100 bg-slate-50 text-slate-600'
          }`}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export default function AgentPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const { darkMode } = useUIStore();

  const agent = agentId ? getAgent(agentId) : undefined;
  if (!agent) return <Navigate to="/" replace />;

  const colors = agentColorMap[agent.color] ?? agentColorMap.blue;
  const component = agentComponents[agent.id];

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      {/* Agent header card */}
      <div
        className={`rounded-[2rem] border p-8 flex items-start gap-5 ${
          darkMode
            ? 'bg-slate-800 border-slate-700'
            : 'bg-white border-slate-200'
        }`}
      >
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0 ${colors.icon}`}
        >
          {iconMap[agent.icon] ?? <Database size={20} />}
        </div>
        <div className="space-y-1 min-w-0">
          <h1
            className={`text-2xl font-black tracking-tight ${
              darkMode ? 'text-white' : 'text-slate-900'
            }`}
          >
            {agent.name}
          </h1>
          <p
            className={`text-sm leading-relaxed ${
              darkMode ? 'text-slate-400' : 'text-slate-600'
            }`}
          >
            {agent.description}
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {agent.tags.map((tag) => (
              <span
                key={tag}
                className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${
                  darkMode
                    ? 'border-slate-700 text-slate-500'
                    : 'border-slate-200 text-slate-400'
                }`}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Collapsible info accordions */}
      <div className="space-y-2">
        <Accordion
          title="How it works"
          icon={<Info size={14} />}
          darkMode={darkMode}
        >
          {agent.howItWorks}
        </Accordion>
        <Accordion
          title="Instructions"
          icon={<BookOpen size={14} />}
          darkMode={darkMode}
        >
          <ol className="space-y-2 list-none">
            {agent.instructions.split('. Step ').map((step, i) => {
              const text = i === 0 ? step.replace(/^Step \d+: /, '') : step.replace(/^\d+: /, '');
              return (
                <li key={i} className="flex gap-2">
                  <span
                    className={`text-[9px] font-black uppercase tracking-widest mt-0.5 shrink-0 w-4 ${
                      colors.accent
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span>{text.replace(/\.$/, '')}</span>
                </li>
              );
            })}
          </ol>
        </Accordion>
      </div>

      {/* Agent interactive component */}
      <div>
        {component ?? (
          <div
            className={`rounded-[2rem] border border-dashed flex items-center justify-center py-20 ${
              darkMode ? 'border-slate-700 text-slate-600' : 'border-slate-200 text-slate-400'
            }`}
          >
            <p className="text-sm font-bold">Agent UI coming soon</p>
          </div>
        )}
      </div>
    </div>
  );
}
