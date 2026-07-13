// AI Audit Agent: dynamic flow only — DynamicUploadStep → ResultsPanel.

import { useState } from 'react';
import { FileSearch, Loader2 } from 'lucide-react';
import DynamicUploadStep, { type ProcessResult } from './DynamicUploadStep';
import ResultsPanel from './ResultsPanel';
import { useSession } from '../../lib/useSession';
import api from '../../lib/api';

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

export default function AuditAgent() {
  const sessionId = useSession();

  const [step, setStep] = useState<Step>('Upload & Questions');
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditCategory, setAuditCategory] = useState('');
  const [auditResults, setAuditResults] = useState<AuditResultItem[]>([]);
  const [auditSummary, setAuditSummary] = useState<AuditSummary | null>(null);

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
      const data =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { detail?: string; error?: string } } }).response?.data
          : undefined;
      setAuditError(data?.detail || data?.error || 'Audit failed. Please try again.');
    }
    setAuditLoading(false);
  };

  const handleBack = () => setStep('Upload & Questions');

  const stepIdx = STEPS.indexOf(step);

  const cardSubtitle =
    step === 'Upload & Questions'
      ? 'Upload documents and your custom audit questions'
      : auditSummary
      ? `${auditSummary.compliance_rate}% compliant · ${auditSummary.action_items} actions`
      : '';

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold transition-all ${
                i <= stepIdx
                  ? 'bg-amber-400 text-[#0a0a0a]'
                  : 'bg-[#1a1a1a] text-[#525252]'
              }${i === stepIdx ? ' ring-4 ring-amber-400/20' : ''}`}
            >
              {i + 1}
            </div>
            <span
              className={`text-[12px] font-semibold uppercase tracking-widest ${
                i === stepIdx ? 'text-[#fafafa]' : 'text-[#525252]'
              }`}
            >
              {s}
            </span>
            {i < STEPS.length - 1 && (
              <div
                className={`flex-1 h-px w-8 ${i < stepIdx ? 'bg-amber-400' : 'bg-[#262626]'}`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Content card */}
      <div className="rounded-[10px] border border-[#1e1e1e] bg-[#111111] p-8">
        {/* Card header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="bg-amber-400 p-2.5 rounded-[8px] text-[#0a0a0a]">
            <FileSearch size={18} />
          </div>
          <div>
            <h2 className="text-[18px] font-semibold text-[#fafafa]">
              {step === 'Upload & Questions' ? 'Upload Documents & Questions' : 'Audit Results'}
            </h2>
            <p className="text-[13px] text-[#525252]">{cardSubtitle}</p>
          </div>
        </div>

        {/* Audit loading overlay */}
        {auditLoading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 size={28} className="animate-spin text-amber-400" />
            <p className="text-[14px] text-[#525252]">Running audit — this may take a moment…</p>
          </div>
        )}

        {/* Upload & Questions step */}
        {!auditLoading && step === 'Upload & Questions' && (
          <>
            {auditError && (
              <p className="text-[13px] text-red-400 font-medium mb-4">{auditError}</p>
            )}
            <DynamicUploadStep
              sessionId={sessionId}
              onProcessed={handleDynamicProcessed}
            />
          </>
        )}

        {/* Results step */}
        {!auditLoading && step === 'Results' && auditSummary && (
          <ResultsPanel
            sessionId={sessionId}
            category={auditCategory}
            results={auditResults}
            summary={auditSummary}
          />
        )}
      </div>

      {/* Back navigation */}
      {step !== 'Upload & Questions' && !auditLoading && (
        <button
          onClick={handleBack}
          className="text-[12px] font-semibold uppercase tracking-widest text-[#525252] hover:text-[#a3a3a3] transition-colors"
        >
          ← Back
        </button>
      )}
    </div>
  );
}
