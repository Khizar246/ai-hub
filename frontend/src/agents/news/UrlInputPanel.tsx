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
  darkMode: boolean;
  sessionId: string;
  onIngested: (articles: ArticleSummary[]) => void;
}

const MAX_URLS = 5;

export default function UrlInputPanel({ darkMode, sessionId: _sessionId, onIngested }: UrlInputPanelProps) {
  const [urls, setUrls] = useState<string[]>(['']);
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
    if (status === 'skipped') return <SkipForward size={14} className="text-slate-400 shrink-0" />;
    return                           <XCircle     size={14} className="text-red-400 shrink-0" />;
  };

  const statusLabel = (a: ArticleSummary) => {
    if (a.status === 'ok')      return `${a.word_count.toLocaleString()} words`;
    if (a.status === 'skipped') return 'Already indexed';
    return a.error ?? 'Error';
  };

  return (
    <div
      className={`rounded-[2.5rem] border p-10 space-y-8 shadow-sm ${
        darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="bg-emerald-500 p-2.5 rounded-xl text-white shadow-lg shadow-emerald-500/30">
          <Rss size={18} />
        </div>
        <div>
          <h2 className="text-lg font-black">Add Article URLs</h2>
          <p className={`text-xs font-medium ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Up to {MAX_URLS} URLs per session
          </p>
        </div>
      </div>

      {/* URL inputs */}
      <div className="space-y-3">
        {urls.map((url, i) => (
          <div key={i} className="flex gap-2 items-center">
            <span className={`text-[10px] font-black w-6 text-center shrink-0 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              {i + 1}
            </span>
            <input
              type="url"
              value={url}
              onChange={(e) => updateUrl(i, e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && i === urls.length - 1) addUrl(); }}
              placeholder="https://example.com/article"
              className={`flex-1 px-5 py-3.5 rounded-2xl text-sm font-medium outline-none transition-all ${
                darkMode
                  ? 'bg-slate-900 text-white placeholder-slate-600 focus:ring-1 focus:ring-emerald-500'
                  : 'bg-slate-50 text-slate-800 placeholder-slate-400 border border-transparent focus:border-emerald-400'
              }`}
            />
            <button
              onClick={() => removeUrl(i)}
              className={`p-2.5 rounded-xl transition-colors shrink-0 ${
                darkMode ? 'hover:bg-slate-700 text-slate-500' : 'hover:bg-slate-100 text-slate-400'
              }`}
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
          className="flex-1 !bg-emerald-500 hover:!bg-emerald-600 !shadow-emerald-500/20"
        >
          {loading ? 'Processing…' : 'Ingest Articles'}
        </Button>
      </div>

      {/* Error */}
      {error && <p className="text-xs text-red-400 font-bold px-1">{error}</p>}

      {/* Per-article results */}
      {articles.length > 0 && (
        <div className="space-y-2">
          <p className={`text-[10px] font-black uppercase tracking-widest ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            Processing Results
          </p>
          {articles.map((a, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${
                a.status === 'ok'
                  ? darkMode ? 'bg-emerald-900/20 border-emerald-800' : 'bg-emerald-50 border-emerald-100'
                  : a.status === 'error'
                  ? darkMode ? 'bg-red-900/20 border-red-900' : 'bg-red-50 border-red-100'
                  : darkMode ? 'bg-slate-900/40 border-slate-700' : 'bg-slate-50 border-slate-100'
              }`}
            >
              {statusIcon(a.status)}
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-bold truncate ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                  {a.title !== a.url ? a.title : a.url}
                </p>
                <p className={`text-[10px] ${a.status === 'error' ? 'text-red-400' : darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
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
