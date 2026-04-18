// News Research Agent: URL input panel + chat interface.
// Uses useUIStore for dark mode and useSession for session ID (no own nav — Shell handles that).

import { useState } from 'react';
import { Newspaper } from 'lucide-react';
import UrlInputPanel from './UrlInputPanel';
import ChatInterface from './ChatInterface';
import { useUIStore } from '../../lib/store';
import { useSession } from '../../lib/useSession';

interface ArticleSummary {
  url: string;
  title: string;
  word_count: number;
  status: 'ok' | 'skipped' | 'error';
  error?: string;
}

export default function NewsAgent() {
  const { darkMode } = useUIStore();
  const sessionId = useSession();

  const [indexedArticles, setIndexedArticles] = useState<ArticleSummary[]>([]);

  const hasArticles = indexedArticles.some(
    (a) => a.status === 'ok' || a.status === 'skipped'
  );
  const indexedCount = indexedArticles.filter(
    (a) => a.status === 'ok' || a.status === 'skipped'
  ).length;

  const handleIngested = (articles: ArticleSummary[]) => {
    setIndexedArticles((prev) => {
      const byUrl = new Map(prev.map((a) => [a.url, a]));
      for (const a of articles) byUrl.set(a.url, a);
      return Array.from(byUrl.values());
    });
  };

  return (
    <div className="space-y-6">
      {/* Article count badge (replaces nav badge from old standalone layout) */}
      {indexedCount > 0 && (
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-black ${
              darkMode
                ? 'bg-emerald-900/30 border-emerald-700 text-emerald-400'
                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            }`}
          >
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            {indexedCount} article{indexedCount !== 1 ? 's' : ''} ready
          </div>
        </div>
      )}

      {/* URL input panel — always visible */}
      <UrlInputPanel
        darkMode={darkMode}
        sessionId={sessionId}
        onIngested={handleIngested}
      />

      {/* Chat interface — appears after first successful ingestion */}
      {hasArticles && (
        <div className="animate-in fade-in duration-500">
          <ChatInterface
            darkMode={darkMode}
            sessionId={sessionId}
            articleCount={indexedCount}
          />
        </div>
      )}

      {/* Empty state */}
      {!hasArticles && (
        <div
          className={`rounded-[2rem] border border-dashed flex flex-col items-center justify-center py-20 gap-4 ${
            darkMode ? 'border-slate-700 text-slate-600' : 'border-slate-200 text-slate-300'
          }`}
        >
          <Newspaper size={48} />
          <p className="text-sm font-black uppercase tracking-widest">
            Ingest articles to begin chatting
          </p>
        </div>
      )}
    </div>
  );
}
