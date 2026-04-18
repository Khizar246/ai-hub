// NL query input, SQL output, execution results — uses CodeBlock for SQL, api.ts for requests.

import { useState } from 'react';
import {
  Activity, CheckCircle, Cpu, Edit3, FileText,
  Play, RotateCcw, Search, Send, X,
} from 'lucide-react';
import HeroCard from './HeroCard';
import CodeBlock from '../../components/ui/CodeBlock';
import ChatBubble from '../../components/ui/ChatBubble';
import api from '../../lib/api';

interface PostgresConfig {
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
}

interface HistoryEntry {
  id: number;
  sql: string;
  originalSql: string;
  explanation: string;
  dialect: string;
  userQuestion: string;
}

interface QueryResult {
  columns: string[];
  rows: (string | number | null)[][];
  hero_data: Record<string, string | number | null> | null;
}

interface QueryWorkspaceProps {
  darkMode: boolean;
  sessionId: string;
  dialect: string;
  pgConfig: PostgresConfig;
  onStatusChange?: (status: string) => void;
}

function formatValue(val: string | number | null): string {
  if (typeof val === 'number') {
    return val.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }
  return String(val ?? '');
}

export default function QueryWorkspace({
  darkMode,
  sessionId: _sessionId,
  dialect,
  pgConfig,
  onStatusChange,
}: QueryWorkspaceProps) {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [results, setResults] = useState<Record<number, QueryResult>>({});
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [execErrors, setExecErrors] = useState<Record<number, string>>({});

  const onAsk = async () => {
    if (!question.trim()) return;
    setLoading(true);
    onStatusChange?.('Thinking…');
    try {
      const res = await api.post('/agents/data/ask', { question });
      const entry: HistoryEntry = {
        ...res.data,
        originalSql: res.data.sql,
        userQuestion: question,
        id: Date.now(),
      };
      setHistory((prev) => [entry, ...prev]);
      setQuestion('');
      onStatusChange?.('Success');
    } catch {
      onStatusChange?.('AI Error');
    }
    setLoading(false);
  };

  const runQuery = async (id: number, sql: string) => {
    onStatusChange?.('Executing…');
    try {
      const res = await api.post('/agents/data/execute', { query: sql, dialect, config: pgConfig });
      setExecErrors((prev) => { const next = { ...prev }; delete next[id]; return next; });
      setResults((prev) => ({ ...prev, [id]: res.data }));
      onStatusChange?.('Query Success');
    } catch (err: unknown) {
      const detail =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined;
      setExecErrors((prev) => ({ ...prev, [id]: detail || 'Execution failed.' }));
      onStatusChange?.('Error');
    }
  };

  const updateSql = (id: number, sql: string) =>
    setHistory((prev) => prev.map((h) => (h.id === id ? { ...h, sql } : h)));

  const resetSql = (id: number) =>
    setHistory((prev) =>
      prev.map((h) => (h.id === id ? { ...h, sql: h.originalSql } : h))
    );

  const copyToClipboard = (id: number, sql: string) => {
    navigator.clipboard.writeText(sql);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const removeResult = (id: number) => {
    setResults((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setExecErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  return (
    <>
      {/* Query input bar */}
      <div className="w-full mb-16">
        <div className="max-w-5xl mx-auto">
          <div className="relative">
            <div className="absolute left-7 top-1/2 -translate-y-1/2 text-slate-400">
              <Search size={24} />
            </div>
            <input
              className={`w-full pl-16 pr-44 py-7 rounded-[2.5rem] shadow-2xl outline-none text-xl font-medium transition-all ${
                darkMode
                  ? 'bg-slate-800 border-slate-700 text-white focus:ring-purple-500/20'
                  : 'bg-white border-slate-200 focus:ring-8 focus:ring-purple-500/5 focus:border-purple-500 border'
              }`}
              placeholder="Ask a question about your data…"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onAsk()}
            />
            <button
              onClick={onAsk}
              disabled={loading}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-[#0F172A] dark:bg-purple-600 text-white px-10 py-4 rounded-[2rem] font-bold hover:scale-105 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-60"
            >
              Analyze
              {loading ? <Activity size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </div>
        </div>
      </div>

      {/* History entries */}
      <div className="space-y-24">
        {history.map((item) => (
          <div key={item.id} className="animate-in fade-in duration-500">
            {/* User question bubble */}
            <div className="mb-8">
              <ChatBubble role="user" content={item.userQuestion} />
            </div>

            <div className="flex flex-col lg:flex-row gap-10">
              {/* SQL panel (65%) — uses CodeBlock; falls back to editable textarea */}
              <div className="flex-[0.65] space-y-4">
                <div className="bg-[#0F172A] rounded-[3.5rem] border border-white/5 shadow-2xl overflow-hidden relative group">
                  {/* Hover action buttons */}
                  <div className="absolute top-8 right-8 flex gap-2 opacity-0 group-hover:opacity-100 transition-all z-10">
                    <button
                      onClick={() => resetSql(item.id)}
                      className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl"
                    >
                      <RotateCcw size={18} />
                    </button>
                    <button
                      onClick={() => setEditingId(editingId === item.id ? null : item.id)}
                      className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl"
                    >
                      <Edit3 size={18} />
                    </button>
                    <button
                      onClick={() => copyToClipboard(item.id, item.sql)}
                      className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl"
                    >
                      {copiedId === item.id ? (
                        <CheckCircle size={18} className="text-emerald-400" />
                      ) : (
                        <CheckCircle size={18} className="opacity-60" />
                      )}
                    </button>
                  </div>

                  <div className="p-8 min-h-[220px]">
                    {editingId === item.id ? (
                      <textarea
                        className="w-full bg-transparent text-blue-200 font-mono text-base outline-none min-h-[180px] resize-none"
                        value={item.sql}
                        onChange={(e) => updateSql(item.id, e.target.value)}
                      />
                    ) : (
                      <CodeBlock code={item.sql} language="sql" />
                    )}
                  </div>

                  <div className="bg-white/5 p-8 border-t border-white/5">
                    <button
                      onClick={() => runQuery(item.id, item.sql)}
                      className="bg-purple-600 hover:bg-purple-500 text-white px-10 py-4 rounded-2xl font-bold flex items-center gap-3 transition-all shadow-xl"
                    >
                      <Play size={20} /> Execute Query
                    </button>
                  </div>
                </div>
              </div>

              {/* Logic panel (35%) */}
              <div className="flex-[0.35]">
                <div
                  className={`rounded-[3rem] p-10 shadow-sm h-full flex flex-col justify-between border ${
                    darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-3 mb-6 text-slate-400">
                      <Cpu size={20} />
                      <span className="text-[10px] font-black uppercase tracking-[0.3em]">
                        Query Logic
                      </span>
                    </div>
                    <p
                      className={`text-[15px] leading-relaxed font-medium italic border-l-4 border-purple-500 pl-6 ${
                        darkMode ? 'text-slate-300' : 'text-slate-600'
                      }`}
                    >
                      {item.explanation}
                    </p>
                  </div>
                  <div
                    className={`mt-8 pt-6 border-t ${
                      darkMode ? 'border-slate-700' : 'border-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle size={14} className="text-emerald-500" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                        Validated Technical Logic
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Execution error */}
            {execErrors[item.id] && (
              <div className="mt-6 flex items-start gap-3 px-6 py-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-medium">
                <X size={16} className="mt-0.5 shrink-0" />
                <span>{execErrors[item.id]}</span>
              </div>
            )}

            {/* Results section */}
            {results[item.id] && (
              <div className="mt-10 grid grid-cols-1 xl:grid-cols-4 gap-10">
                {results[item.id].hero_data && (
                  <HeroCard heroData={results[item.id].hero_data!} />
                )}

                <div
                  className={`${
                    results[item.id].hero_data ? 'xl:col-span-3' : 'xl:col-span-4'
                  } rounded-[3.5rem] border shadow-sm overflow-hidden ${
                    darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
                  }`}
                >
                  <div
                    className={`px-10 py-6 border-b flex justify-between items-center ${
                      darkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-3 text-slate-400">
                      <FileText size={18} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Dataset</span>
                    </div>
                    <button
                      onClick={() => removeResult(item.id)}
                      className={`p-1 rounded-full transition-colors ${
                        darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-200'
                      }`}
                    >
                      <X size={20} />
                    </button>
                  </div>

                  <div className="overflow-x-auto max-h-[500px]">
                    <table className="w-full text-left">
                      <thead className={`sticky top-0 ${darkMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
                        <tr>
                          {results[item.id].columns.map((c) => (
                            <th
                              key={c}
                              className="px-10 py-6 font-black text-slate-400 uppercase tracking-widest text-[11px]"
                            >
                              {c}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody
                        className={`divide-y ${darkMode ? 'divide-slate-700' : 'divide-slate-50'}`}
                      >
                        {results[item.id].rows.map((row, rIdx) => (
                          <tr
                            key={rIdx}
                            className={`transition-colors ${
                              darkMode ? 'hover:bg-slate-700' : 'hover:bg-purple-50/40'
                            }`}
                          >
                            {row.map((cell, cIdx) => (
                              <td
                                key={cIdx}
                                className={`px-10 py-6 font-semibold text-sm ${
                                  darkMode ? 'text-slate-300' : 'text-slate-600'
                                }`}
                              >
                                {formatValue(cell)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
