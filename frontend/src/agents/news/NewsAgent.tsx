// News Research Agent: URL input panel + chat interface.

import { useState } from 'react';
import { Newspaper } from 'lucide-react';
import UrlInputPanel from './UrlInputPanel';
import ChatInterface from './ChatInterface';
import { useSession } from '../../lib/useSession';

interface ArticleSummary {
  url: string;
  title: string;
  word_count: number;
  status: 'ok' | 'skipped' | 'error';
  error?: string;
}

export default function NewsAgent() {
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
      {/* Article count badge */}
      {indexedCount > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#262626] bg-[#111111] text-[12px] font-semibold text-[#a3a3a3]">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            {indexedCount} article{indexedCount !== 1 ? 's' : ''} ready
          </div>
        </div>
      )}

      {/* URL input panel — always visible */}
      <UrlInputPanel
        sessionId={sessionId}
        onIngested={handleIngested}
      />

      {/* Chat interface — appears after first successful ingestion */}
      {hasArticles && (
        <div className="animate-in fade-in duration-500">
          <ChatInterface
            sessionId={sessionId}
            articleCount={indexedCount}
          />
        </div>
      )}

      {/* Empty state */}
      {!hasArticles && (
        <div className="border border-dashed border-[#1e1e1e] rounded-[10px] flex flex-col items-center justify-center py-20 gap-4 text-[#525252]">
          <Newspaper size={36} />
          <p className="text-[14px] font-semibold">Ingest articles to begin chatting</p>
        </div>
      )}
    </div>
  );
}
