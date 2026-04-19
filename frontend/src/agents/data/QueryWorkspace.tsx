// NL query input, SQL output, execution results — uses CodeBlock for SQL, api.ts for requests.

import { useState, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Activity, CheckCircle, ChevronDown, Copy, Download, Edit3, FileText,
  Play, RotateCcw, Search, Send, X,
} from 'lucide-react';
import CodeBlock from '../../components/ui/CodeBlock';
import api from '../../lib/api';

interface PostgresConfig {
  db_type: 'postgresql' | 'mysql' | 'mssql';
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
  ssl_required: boolean;
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

function renderExplanation(text: string) {
  if (!text) return null;
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const bulletLines = lines.filter(l => l.startsWith('-'));
  const summaryLines = lines.filter(l => !l.startsWith('-'));
  const summary = summaryLines.join(' ').trim();

  return (
    <div className="flex flex-col gap-3">
      {summary && (
        <p className="text-[13px] text-[#fafafa] font-medium leading-snug">
          {summary}
        </p>
      )}
      {bulletLines.length > 0 && (
        <ul className="flex flex-col gap-2.5">
          {bulletLines.map((line, i) => {
            const content = line.replace(/^-\s*/, '');
            const colonIdx = content.indexOf(':');
            const label = colonIdx > -1 ? content.slice(0, colonIdx).trim() : null;
            const body = colonIdx > -1 ? content.slice(colonIdx + 1).trim() : content;
            return (
              <li key={i} className="flex flex-col gap-0.5">
                {label && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                    {label}
                  </span>
                )}
                <span className="text-[12px] text-[#a3a3a3] leading-relaxed">{body}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ResultsTable({
  result,
  sortCol,
  sortDir,
  onSort,
  onExportCSV,
  onClear,
}: {
  result: QueryResult;
  sortCol: string | null;
  sortDir: 'asc' | 'desc';
  onSort: (col: string) => void;
  onExportCSV: (result: QueryResult) => void;
  onClear: () => void;
}) {
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const sortedRows = sortCol
    ? [...result.rows].sort((a, b) => {
        const colIdx = result.columns.indexOf(sortCol);
        if (colIdx === -1) return 0;
        const aVal = a[colIdx] ?? '';
        const bVal = b[colIdx] ?? '';
        if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
        return 0;
      })
    : result.rows;

  const rowVirtualizer = useVirtualizer({
    count: sortedRows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 44,
    overscan: 10,
  });

  return (
    <div className="bg-[#111111] border border-[#1e1e1e] rounded-[10px] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1e1e1e] bg-[#0f0f0f]">
        <div className="flex items-center gap-2 text-[#525252]">
          <FileText size={12} />
          <span className="text-[11px] font-semibold uppercase tracking-widest">Dataset</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#525252]">
            {result.rows.length.toLocaleString()} rows
          </span>
          <button
            onClick={() => onExportCSV(result)}
            className="flex items-center gap-1 border border-[#262626] text-[#a3a3a3] hover:text-[#fafafa] hover:border-[#404040] rounded-[4px] px-2 py-1 text-[11px] transition-colors duration-150"
          >
            <Download size={11} /> Export CSV
          </button>
          <button
            onClick={onClear}
            className="p-1 rounded-full transition-colors hover:bg-[#1a1a1a] text-[#525252] hover:text-[#fafafa]"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Scrollable container — fixed height, virtualised */}
      <div
        ref={tableContainerRef}
        className="overflow-auto"
        style={{ height: Math.min(sortedRows.length * 44 + 44, 440) + 'px' }}
      >
        <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
          {/* Sticky column headers */}
          <thead className="sticky top-0 z-10 bg-[#0f0f0f]">
            <tr>
              {result.columns.map((col) => (
                <th
                  key={col}
                  onClick={() => onSort(col)}
                  className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider cursor-pointer transition-colors duration-100 border-b border-[#1e1e1e] whitespace-nowrap overflow-hidden text-ellipsis"
                  style={{ width: `${100 / result.columns.length}%` }}
                >
                  <span className={sortCol === col ? 'text-amber-400' : 'text-[#525252] hover:text-[#a3a3a3]'}>
                    {col} {sortCol === col ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          {/* Virtualised body */}
          <tbody>
            {/* Top padding spacer */}
            {rowVirtualizer.getVirtualItems().length > 0 && (
              <tr>
                <td
                  colSpan={result.columns.length}
                  style={{ height: `${rowVirtualizer.getVirtualItems()[0].start}px`, padding: 0, border: 'none' }}
                />
              </tr>
            )}

            {/* Only render visible rows */}
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = sortedRows[virtualRow.index];
              return (
                <tr
                  key={virtualRow.index}
                  className="border-b border-[#1a1a1a] hover:bg-[#131313] transition-colors duration-100"
                  style={{ height: `${virtualRow.size}px` }}
                >
                  {result.columns.map((col, colIdx) => (
                    <td
                      key={col}
                      className="px-4 py-2.5 text-[13px] text-[#a3a3a3] overflow-hidden text-ellipsis whitespace-nowrap"
                      style={{ width: `${100 / result.columns.length}%` }}
                      title={formatValue(row[colIdx])}
                    >
                      {formatValue(row[colIdx])}
                    </td>
                  ))}
                </tr>
              );
            })}

            {/* Bottom padding spacer */}
            {rowVirtualizer.getVirtualItems().length > 0 && (
              <tr>
                <td
                  colSpan={result.columns.length}
                  style={{
                    height: `${rowVirtualizer.getTotalSize() - (rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1]?.end ?? 0)}px`,
                    padding: 0,
                    border: 'none',
                  }}
                />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function QueryWorkspace({
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
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [collapsedCards, setCollapsedCards] = useState<Set<number>>(new Set());

  const toggleCard = (index: number) => {
    setCollapsedCards(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const onAsk = async () => {
    if (!question.trim()) return;
    setLoading(true);
    onStatusChange?.('Thinking…');
    try {
      const res = await api.post('/agents/data/ask', { question });
      // Collapse all existing cards (they shift to i+1 after prepend, so mark i+1)
      setCollapsedCards(() => {
        const next = new Set<number>();
        history.forEach((_, i) => next.add(i + 1));
        return next;
      });
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

  const exportCSV = (result: QueryResult) => {
    if (!result?.rows?.length) return;
    const headers = result.columns.join(',');
    const rows = result.rows.map(row =>
      row.map(val => {
        if (val === null || val === undefined) return '';
        const str = String(val);
        return str.includes(',') ? `"${str}"` : str;
      }).join(',')
    ).join('\n');
    const csv = `${headers}\n${rows}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'query_results.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
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
      <div className="w-full mb-10">
        <div className="relative">
          <div className="absolute left-5 top-1/2 -translate-y-1/2 text-[#525252]">
            <Search size={18} />
          </div>
          <input
            className="w-full pl-12 pr-36 py-4 rounded-[8px] outline-none text-[16px] font-medium transition-all bg-[#111111] border border-[#1e1e1e] text-[#fafafa] placeholder-[#525252] focus:border-amber-400/50 focus:ring-1 focus:ring-amber-400/20"
            placeholder="Ask a question about your data…"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onAsk()}
          />
          <button
            onClick={onAsk}
            disabled={loading}
            className="absolute right-3 top-1/2 -translate-y-1/2 bg-amber-400 hover:bg-amber-300 text-[#0a0a0a] px-5 py-2.5 rounded-[6px] font-semibold text-[14px] hover:scale-105 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-60"
          >
            Analyze
            {loading ? <Activity size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>

      {/* History entries — collapsible cards */}
      <div className="space-y-3">
        {history.map((item, index) => (
          <div
            key={item.id}
            className="animate-in fade-in duration-500 bg-[#0d0d0d] border border-[#1e1e1e] rounded-[10px] overflow-hidden transition-all duration-200"
          >
            {/* Card header — always visible */}
            <div
              className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[#111111] transition-colors duration-150"
              onClick={() => toggleCard(index)}
            >
              <div className="flex items-baseline gap-2 flex-1 min-w-0">
                <span className="text-amber-400 font-semibold text-[13px] flex-shrink-0">Q.</span>
                <span className="text-[14px] text-[#fafafa] truncate">{item.userQuestion}</span>
              </div>
              <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                <span className="text-[11px] text-[#525252]">
                  {collapsedCards.has(index) ? 'expand' : 'collapse'}
                </span>
                <ChevronDown
                  size={14}
                  className={`text-[#525252] transition-transform duration-200 ${
                    collapsedCards.has(index) ? '' : 'rotate-180'
                  }`}
                />
              </div>
            </div>

            {/* Card body — collapsible */}
            {!collapsedCards.has(index) && (
              <div className="border-t border-[#1e1e1e] p-4 flex flex-col gap-4">

                {/* SQL + Query Logic: stacked on mobile, side-by-side on desktop */}
                <div className="flex flex-col lg:flex-row gap-4 items-start">

                  {/* SQL card — full width mobile, grows on desktop */}
                  <div className="flex-1 min-w-0 w-full flex flex-col gap-3">
                    <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-[10px] overflow-hidden max-w-full">
                      {/* Code block */}
                      <div className="p-4 md:p-6 min-h-[120px] md:min-h-[160px] overflow-x-auto">
                        {editingId === item.id ? (
                          <textarea
                            className="w-full bg-transparent text-blue-200 font-mono text-[14px] outline-none min-h-[140px] resize-none"
                            value={item.sql}
                            onChange={(e) => updateSql(item.id, e.target.value)}
                          />
                        ) : (
                          <CodeBlock code={item.sql} language="sql" />
                        )}
                      </div>

                      {/* Action toolbar */}
                      <div className="px-6 py-3 border-t border-[#1e1e1e] flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => copyToClipboard(item.id, item.sql)}
                            title="Copy SQL to clipboard"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium border border-white/20 text-white/70 hover:border-white/40 hover:text-white transition-all"
                          >
                            {copiedId === item.id ? (
                              <>
                                <CheckCircle size={12} className="text-emerald-400" />
                                <span className="text-emerald-400">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy size={12} />
                                Copy SQL
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => setEditingId(editingId === item.id ? null : item.id)}
                            title="Edit SQL manually"
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium border transition-all ${
                              editingId === item.id
                                ? 'border-amber-400 text-amber-400 bg-amber-400/10'
                                : 'border-white/20 text-white/70 hover:border-white/40 hover:text-white'
                            }`}
                          >
                            <Edit3 size={12} />
                            Edit
                          </button>
                        </div>
                        <button
                          onClick={() => resetSql(item.id)}
                          title="Reset to original generated SQL"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium border border-white/20 text-white/70 hover:border-red-400/50 hover:text-red-400 transition-all"
                        >
                          <RotateCcw size={12} />
                          Reset
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Query Logic — full width mobile, fixed 260px on desktop */}
                  {item.explanation && (
                    <div className="w-full lg:w-[260px] flex-shrink-0 bg-[#0f0f0f] border border-[#1e1e1e] rounded-[10px] p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#525252]">Query Logic</span>
                      </div>
                      {renderExplanation(item.explanation)}
                    </div>
                  )}

                </div>

                {/* Execute button */}
                <button
                  onClick={() => runQuery(item.id, item.sql)}
                  className="bg-amber-400 text-[#0a0a0a] hover:bg-amber-300 font-semibold rounded-[6px] w-full h-10 flex items-center justify-center gap-2 text-[14px] transition-all"
                >
                  <Play size={16} /> Execute Query
                </button>

                {/* Results table */}
                {results[item.id] && (
                  <ResultsTable
                    result={results[item.id]}
                    sortCol={sortCol}
                    sortDir={sortDir}
                    onSort={toggleSort}
                    onExportCSV={exportCSV}
                    onClear={() => removeResult(item.id)}
                  />
                )}

                {/* Execution error */}
                {execErrors[item.id] && (
                  <div className="bg-[#1a0a0a] border border-red-900/40 rounded-[8px] px-4 py-3 text-[13px] text-red-400 flex items-center gap-2">
                    <X size={14} className="shrink-0" />
                    <span>{execErrors[item.id]}</span>
                  </div>
                )}

              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
