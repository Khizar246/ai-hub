// AI Audit Agent: dynamic flow only — DynamicUploadStep → ResultsPanel.

import { useState } from 'react';
import { FileSearch, Loader2 } from 'lucide-react';
import DynamicUploadStep, { type ProcessResult } from './DynamicUploadStep';
import ResultsPanel from './ResultsPanel';
import { useUIStore } from '../../lib/store';
import { useSession } from '../../lib/useSession';
import api from '../../lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

const STEPS = ['Upload & Questions', 'Results'] as const;
type Step = (typeof STEPS)[number];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AuditAgent() {
  const { darkMode } = useUIStore();
  const sessionId = useSession();

  const [step, setStep] = useState<Step>('Upload & Questions');
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditCategory, setAuditCategory] = useState('');
  const [auditResults, setAuditResults] = useState<AuditResultItem[]>([]);
  const [auditSummary, setAuditSummary] = useState<AuditSummary | null>(null);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleDynamicProcessed = async (_result: ProcessResult) => {
    setAuditLoading(true);
    setAuditError(null);

    try {
      const res = await api.post('/agents/audit/audit-dynamic', null, {
        headers: { 'X-Session-ID': sessionId },
      });
      setAuditResults(res.data.results);
      setAuditSummary(res.data.summary);
      setAuditCategory(res.data.category);
      setStep('Results');
    } catch (err: unknown) {
      const detail =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined;
      setAuditError(detail || 'Audit failed. Please try again.');
    }
    setAuditLoading(false);
  };

  const handleBack = () => setStep('Upload & Questions');

  // ---------------------------------------------------------------------------
  // Step indicator helpers
  // ---------------------------------------------------------------------------

  const stepIdx = STEPS.indexOf(step);

  const cardTitle =
    step === 'Upload & Questions' ? 'Upload Documents & Questions' : 'Audit Results';

  const cardSubtitle =
    step === 'Upload & Questions'
      ? 'Upload documents and your custom audit questions'
      : auditSummary
      ? `${auditSummary.compliance_rate}% compliant · ${auditSummary.action_items} actions`
      : '';

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* ── Step indicator ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${
                i < stepIdx
                  ? 'bg-blue-600 text-white'
                  : i === stepIdx
                  ? 'bg-blue-600 text-white ring-4 ring-blue-600/20'
                  : darkMode
                  ? 'bg-slate-700 text-slate-500'
                  : 'bg-slate-200 text-slate-400'
              }`}
            >
              {i + 1}
            </div>
            <span
              className={`text-xs font-black uppercase tracking-widest ${
                i === stepIdx
                  ? darkMode
                    ? 'text-white'
                    : 'text-slate-800'
                  : darkMode
                  ? 'text-slate-600'
                  : 'text-slate-400'
              }`}
            >
              {s}
            </span>
            {i < STEPS.length - 1 && (
              <div
                className={`flex-1 h-px w-8 ${
                  i < stepIdx ? 'bg-blue-600' : darkMode ? 'bg-slate-700' : 'bg-slate-200'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* ── Content card ───────────────────────────────────────────────── */}
      <div
        className={`rounded-[2.5rem] border p-10 shadow-sm ${
          darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
        }`}
      >
        {/* Card header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="bg-blue-600 p-2.5 rounded-xl text-white shadow-lg shadow-blue-600/30">
            <FileSearch size={18} />
          </div>
          <div>
            <h2 className="text-lg font-black">{cardTitle}</h2>
            <p className={`text-xs font-medium ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {cardSubtitle}
            </p>
          </div>
        </div>

        {/* Audit loading overlay */}
        {auditLoading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 size={32} className="animate-spin text-blue-500" />
            <p className={`text-sm font-bold ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Running audit — this may take a moment…
            </p>
          </div>
        )}

        {/* ── Upload & Questions step ──────────────────────────────────── */}
        {!auditLoading && step === 'Upload & Questions' && (
          <>
            {auditError && (
              <p className="text-xs text-red-400 font-bold mb-4">{auditError}</p>
            )}
            <DynamicUploadStep
              darkMode={darkMode}
              sessionId={sessionId}
              onProcessed={handleDynamicProcessed}
            />
          </>
        )}

        {/* ── Results step ─────────────────────────────────────────────── */}
        {!auditLoading && step === 'Results' && auditSummary && (
          <ResultsPanel
            darkMode={darkMode}
            sessionId={sessionId}
            category={auditCategory}
            results={auditResults}
            summary={auditSummary}
          />
        )}
      </div>

      {/* ── Back navigation ────────────────────────────────────────────── */}
      {step !== 'Upload & Questions' && !auditLoading && (
        <button
          onClick={handleBack}
          className={`text-xs font-black uppercase tracking-widest transition-colors ${
            darkMode
              ? 'text-slate-600 hover:text-slate-400'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          ← Back
        </button>
      )}
    </div>
  );
}
