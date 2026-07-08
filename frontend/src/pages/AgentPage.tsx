// Generic agent page: header + collapsible accordions + agent UI.

import { lazy, Suspense, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { FileSearch, Newspaper, Database, ChevronDown, ChevronUp, Info, BookOpen } from 'lucide-react';
import { getAgent } from '../lib/agentRegistry';

const iconMap: Record<string, React.ElementType> = {
  FileSearch,
  Newspaper,
  Database,
};

// Each agent (and its heavy deps — syntax highlighting, virtualised tables)
// only loads when its own page is visited, instead of all three bundled up front.
const AuditAgent = lazy(() => import('../agents/audit/AuditAgent'));
const NewsAgent = lazy(() => import('../agents/news/NewsAgent'));
const DataAgent = lazy(() => import('../agents/data/DataAgent'));

const agentComponents: Record<string, React.ReactNode> = {
  audit: <AuditAgent />,
  news:  <NewsAgent />,
  data:  <DataAgent />,
};

function Accordion({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-[#1e1e1e] bg-[#111111] rounded-[8px] mb-2 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 md:px-5 py-3 md:py-3.5 text-[14px] font-medium text-[#a3a3a3] hover:text-[#fafafa] flex items-center justify-between cursor-pointer transition-colors duration-100"
      >
        <span className="flex items-center gap-2">
          <span className="text-[#525252]">{icon}</span>
          {title}
        </span>
        {open
          ? <ChevronUp size={13} className="text-[#525252] shrink-0" />
          : <ChevronDown size={13} className="text-[#525252] shrink-0" />
        }
      </button>

      {open && (
        <div className="px-4 md:px-5 pb-4 text-[14px] text-[#525252] leading-relaxed border-t border-[#1e1e1e]">
          <div className="pt-3">{children}</div>
        </div>
      )}
    </div>
  );
}

export default function AgentPage() {
  const { agentId } = useParams<{ agentId: string }>();

  const agent = agentId ? getAgent(agentId) : undefined;
  if (!agent) return <Navigate to="/" replace />;

  const Icon = iconMap[agent.icon] ?? Database;
  const component = agentComponents[agent.id];

  return (
    <div className="max-w-[1000px] mx-auto pb-12 md:pb-16 overflow-hidden">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-5 md:mb-6 min-w-0">
        <Icon size={16} className="text-[#525252] shrink-0 md:w-[18px] md:h-[18px]" />
        <h1 className="text-[20px] md:text-[26px] font-semibold text-[#fafafa] tracking-tight truncate">
          {agent.name}
        </h1>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-5 md:mb-6">
        {agent.tags.map((tag) => (
          <span
            key={tag}
            className="font-mono bg-[#0f0f0f] border border-[#1e1e1e] text-[#525252] text-[11px] px-2 py-0.5 rounded-[3px]"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Accordions */}
      <div className="mb-5 md:mb-6">
        <Accordion title="How it works" icon={<Info size={13} />}>
          {agent.howItWorks}
        </Accordion>
        <Accordion title="Instructions" icon={<BookOpen size={13} />}>
          <ol className="space-y-3 md:space-y-4 list-none pt-1">
            {agent.instructions.split('. Step ').map((step, i) => {
              const text = i === 0 ? step.replace(/^Step \d+: /, '') : step.replace(/^\d+: /, '');
              return (
                <li key={i} className="flex gap-3 items-start">
                  <span className="w-6 h-6 rounded-full bg-amber-400 text-[#0a0a0a] text-[12px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-[13px] md:text-[14px] text-[#525252] leading-relaxed pt-0.5">
                    {text.replace(/\.$/, '')}
                  </span>
                </li>
              );
            })}
          </ol>
        </Accordion>
      </div>

      {/* Agent interactive component */}
      {component ? (
        <Suspense
          fallback={
            <div className="border border-[#1e1e1e] bg-[#111111] rounded-[10px] flex items-center justify-center py-16 md:py-20">
              <p className="text-[14px] text-[#525252]">Loading...</p>
            </div>
          }
        >
          {component}
        </Suspense>
      ) : (
        <div className="border border-[#1e1e1e] bg-[#111111] rounded-[10px] flex items-center justify-center py-16 md:py-20">
          <p className="text-[14px] text-[#525252]">Agent UI coming soon</p>
        </div>
      )}
    </div>
  );
}
