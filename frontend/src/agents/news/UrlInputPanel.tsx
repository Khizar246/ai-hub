// URL input panel: up to 5 fields, Ingest button, per-article status — uses shared Button, api.ts.

import { useState } from 'react';
import { Plus, Trash2, Rss, CheckCircle, XCircle, SkipForward } from 'lucide-react';
import api from '../../lib/api';
import Button from '../../components/ui/Button';

interface ArticleSummary {
  url: string;
  title: string;
  word_count: number;
  status: 'ok' | 'skipped' | 'error';
  error?: string;
}

interface UrlInputPanelProps {
  sessionId: string;
  onIngested: (articles: ArticleSummary[]) => void;
}

const MAX_URLS = 5;

export default function UrlInputPanel({ sessionId: _sessionId, onIngested }: UrlInputPanelProps) {
  const [urls, setUrls] = useState<string[]>(['https://red.anthropic.com/2026/mythos-preview/']);
  const [loading, setLoading] = useState(false);
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  const addUrl = () => { if (urls.length < MAX_URLS) setUrls([...urls, '']); };
  const removeUrl = (i: number) => {
    setUrls(urls.length === 1 ? [''] : urls.filter((_, idx) => idx !== i));
  };
  const updateUrl = (i: number, value: string) => {
    const next = [...urls];
    next[i] = value;
    setUrls(next);
  };

  const handleIngest = async () => {
    const validUrls = urls.map((u) => u.trim()).filter(Boolean);
    if (validUrls.length === 0) { setError('Please enter at least one URL.'); return; }
    setError(null);
    setLoading(true);
    setArticles([]);

    try {
      const res = await api.post('/agents/news/ingest', { urls: validUrls });
      const summaries: ArticleSummary[] = res.data.articles;
      setArticles(summaries);
      onIngested(summaries);
    } catch (err: unknown) {
      const detail =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined;
      setError(detail || 'Ingestion failed. Check your URLs and try again.');
    }
    setLoading(false);
  };

  const statusIcon = (status: ArticleSummary['status']) => {
    if (status === 'ok')      return <CheckCircle size={14} className="text-emerald-500 shrink-0" />;
    if (status === 'skipped') return <SkipForward  size={14} className="text-[#525252] shrink-0" />;
    return                           <XCircle      size={14} className="text-red-400 shrink-0" />;
  };

  const statusLabel = (a: ArticleSummary) => {
    if (a.status === 'ok')      return `${a.word_count.toLocaleString()} words`;
    if (a.status === 'skipped') return 'Already indexed';
    return a.error ?? 'Error';
  };

  return (
    <div className="rounded-[10px] border border-[#1e1e1e] bg-[#111111] p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="bg-amber-400 p-2.5 rounded-[8px] text-[#0a0a0a]">
          <Rss size={18} />
        </div>
        <div>
          <h2 className="text-[18px] font-semibold text-[#fafafa]">Add Article URLs</h2>
          <p className="text-[13px] text-[#525252]">Up to {MAX_URLS} URLs per session</p>
        </div>
      </div>

      {/* Sample hint */}
      <div className="flex items-start gap-2 px-4 py-3 rounded-[8px] border border-amber-400/20 bg-amber-400/5 text-[13px] text-[#a3a3a3]">
        <span>
          💡 A sample article is pre-loaded — click <strong className="text-[#fafafa]">Ingest Articles</strong> to try it instantly, or replace with your own URL.
        </span>
      </div>

      {/* URL inputs */}
      <div className="space-y-3">
        {urls.map((url, i) => (
          <div key={i} className="flex gap-2 items-center">
            <span className="text-[11px] font-semibold w-6 text-center shrink-0 text-[#525252]">
              {i + 1}
            </span>
            <input
              type="url"
              value={url}
              onChange={(e) => updateUrl(i, e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && i === urls.length - 1) addUrl(); }}
              placeholder="https://example.com/article"
              className="flex-1 px-4 py-3 rounded-[6px] text-[14px] font-medium outline-none transition-all bg-[#0f0f0f] text-[#fafafa] placeholder-[#525252] border border-[#262626] focus:border-amber-400/50 focus:ring-1 focus:ring-amber-400/20"
            />
            <button
              onClick={() => removeUrl(i)}
              className="p-2.5 rounded-[6px] transition-colors shrink-0 hover:bg-[#1a1a1a] text-[#525252] hover:text-[#a3a3a3]"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>

      {/* Add URL + Ingest row */}
      <div className="flex gap-3">
        {urls.length < MAX_URLS && (
          <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={addUrl}>
            Add URL
          </Button>
        )}
        <Button
          variant="primary"
          size="md"
          loading={loading}
          onClick={handleIngest}
          className="flex-1"
        >
          {loading ? 'Processing…' : 'Ingest Articles'}
        </Button>
      </div>

      {/* Error */}
      {error && <p className="text-[13px] text-red-400 font-medium px-1">{error}</p>}

      {/* Per-article results */}
      {articles.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#525252]">
            Processing Results
          </p>
          {articles.map((a, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 px-4 py-3 rounded-[8px] border ${
                a.status === 'ok'
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : a.status === 'error'
                  ? 'bg-red-500/10 border-red-500/30'
                  : 'bg-[#0f0f0f] border-[#1e1e1e]'
              }`}
            >
              {statusIcon(a.status)}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold truncate text-[#a3a3a3]">
                  {a.title !== a.url ? a.title : a.url}
                </p>
                <p className={`text-[11px] ${a.status === 'error' ? 'text-red-400' : 'text-[#525252]'}`}>
                  {statusLabel(a)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
