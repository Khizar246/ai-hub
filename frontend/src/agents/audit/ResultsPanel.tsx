// Audit results: stats bar, sortable table, and Excel export.

import { useState } from 'react';
import { Download, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../../lib/api';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import StatusPill from '../../components/ui/StatusPill';
import ProgressBar from '../../components/ui/ProgressBar';

interface AuditResultItem {
  rule: string;
  status: string;
  observation: string;
  recommendation: string;
  risk: string;
  page_numbers: string;
  confidence_score: number;
  criticality: string;
  requires_action: boolean;
}

interface AuditSummary {
  total_rules: number;
  status_counts: Record<string, number>;
  action_items: number;
  high_priority_issues: number;
  average_confidence: number;
  compliance_rate: number;
}

interface ResultsPanelProps {
  darkMode: boolean;
  sessionId: string;
  category: string;
  results: AuditResultItem[];
  summary: AuditSummary;
}

const criticalityVariant: Record<string, 'high' | 'medium' | 'low'> = {
  High: 'high', Medium: 'medium', Low: 'low',
};

export default function ResultsPanel({
  darkMode, sessionId, category, results, summary,
}: ResultsPanelProps) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [sortField, setSortField] = useState<'criticality' | 'status' | 'confidence_score'>('criticality');
  const [sortAsc, setSortAsc] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.post(
        '/agents/audit/export',
        { session_id: sessionId, category },
        { responseType: 'blob' },
      );
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit_${category.replace(/ /g, '_')}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* silent */
    }
    setExporting(false);
  };

  const sortedResults = [...results].sort((a, b) => {
    const critOrder: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
    const statusOrder: Record<string, number> = {
      'Not Present': 0, 'Inadequate': 1, 'Partially Present': 2, 'Present': 3,
    };
    let cmp = 0;
    if (sortField === 'criticality') {
      cmp = (critOrder[a.criticality] ?? 9) - (critOrder[b.criticality] ?? 9);
    } else if (sortField === 'status') {
      cmp = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
    } else {
      cmp = a.confidence_score - b.confidence_score;
    }
    return sortAsc ? cmp : -cmp;
  });

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(false); }
  };

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Compliance', value: `${summary.compliance_rate}%`, color: 'text-emerald-500' },
          { label: 'Action items', value: summary.action_items, color: 'text-red-400' },
          { label: 'High priority', value: summary.high_priority_issues, color: 'text-orange-400' },
          { label: 'Avg confidence', value: `${(summary.average_confidence * 100).toFixed(0)}%`, color: 'text-blue-400' },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className={`rounded-2xl p-4 border text-center ${
              darkMode ? 'bg-slate-900/40 border-slate-700' : 'bg-slate-50 border-slate-100'
            }`}
          >
            <p className={`text-2xl font-black ${color}`}>{value}</p>
            <p className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${
              darkMode ? 'text-slate-500' : 'text-slate-400'
            }`}>{label}</p>
          </div>
        ))}
      </div>

      {/* Export button */}
      <div className="flex justify-end">
        <Button
          variant="primary"
          size="sm"
          loading={exporting}
          icon={!exporting ? <Download size={14} /> : undefined}
          onClick={handleExport}
          className="!bg-blue-600 hover:!bg-blue-700 !shadow-blue-600/20"
        >
          {exporting ? 'Exporting…' : 'Export Excel'}
        </Button>
      </div>

      {/* Results table */}
      <div className="space-y-2">
        {/* Sort controls */}
        <div className={`flex gap-2 px-1 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          {(['criticality', 'status', 'confidence_score'] as const).map((field) => (
            <button
              key={field}
              onClick={() => toggleSort(field)}
              className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1 transition-colors ${
                sortField === field
                  ? darkMode ? 'text-blue-400' : 'text-blue-600'
                  : ''
              }`}
            >
              {field === 'confidence_score' ? 'Confidence' : field}
              {sortField === field && (sortAsc ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
            </button>
          ))}
        </div>

        {sortedResults.map((item, idx) => {
          const expanded = expandedIdx === idx;
          return (
            <div
              key={idx}
              className={`rounded-2xl border overflow-hidden transition-all ${
                item.requires_action
                  ? darkMode
                    ? 'border-red-900/50'
                    : 'border-red-100'
                  : darkMode
                  ? 'border-slate-700'
                  : 'border-slate-100'
              }`}
            >
              {/* Row header */}
              <button
                onClick={() => setExpandedIdx(expanded ? null : idx)}
                className={`w-full flex items-start gap-3 px-5 py-4 text-left transition-colors ${
                  darkMode
                    ? 'bg-slate-800 hover:bg-slate-700/60'
                    : 'bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <p className={`text-xs font-bold leading-snug line-clamp-2 ${
                    darkMode ? 'text-slate-200' : 'text-slate-800'
                  }`}>
                    {item.rule}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill status={item.status} />
                    <Badge variant={criticalityVariant[item.criticality] ?? 'medium'}>
                      {item.criticality}
                    </Badge>
                    {item.page_numbers && item.page_numbers !== 'Not Specified' && (
                      <span className={`text-[9px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        p. {item.page_numbers}
                      </span>
                    )}
                  </div>
                </div>
                <div className="shrink-0 mt-0.5">
                  {expanded ? (
                    <ChevronUp size={14} className={darkMode ? 'text-slate-500' : 'text-slate-400'} />
                  ) : (
                    <ChevronDown size={14} className={darkMode ? 'text-slate-500' : 'text-slate-400'} />
                  )}
                </div>
              </button>

              {/* Expanded detail */}
              {expanded && (
                <div
                  className={`px-5 pb-5 pt-3 space-y-3 border-t ${
                    darkMode ? 'border-slate-700 bg-slate-900/40' : 'border-slate-100 bg-slate-50'
                  }`}
                >
                  {[
                    { label: 'Observation', text: item.observation },
                    item.recommendation ? { label: 'Recommendation', text: item.recommendation } : null,
                    item.risk ? { label: 'Risk', text: item.risk } : null,
                  ]
                    .filter(Boolean)
                    .map((section) => (
                      <div key={section!.label}>
                        <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${
                          darkMode ? 'text-slate-500' : 'text-slate-400'
                        }`}>
                          {section!.label}
                        </p>
                        <p className={`text-xs leading-relaxed ${
                          darkMode ? 'text-slate-300' : 'text-slate-700'
                        }`}>
                          {section!.text}
                        </p>
                      </div>
                    ))}

                  <ProgressBar
                    value={Math.round(item.confidence_score * 100)}
                    color="blue"
                    label="Confidence"
                    showPercentage
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
