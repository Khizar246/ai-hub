// Dynamic upload step: two drop zones (document + questions CSV) for custom audit flow.

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Upload,
  FileText,
  Film,
  BookOpen,
  BarChart3,
  AlignLeft,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  X,
  Loader2,
} from 'lucide-react';
import api from '../../lib/api';
import Button from '../../components/ui/Button';
import ProgressBar from '../../components/ui/ProgressBar';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QuestionValidation {
  valid: boolean;
  question_count: number;
  preview: string[];
  error: string | null;
}

interface FileSummary {
  filename: string;
  type: string;
  pages: number;
  vision_used: number;
}

export interface ProcessResult {
  session_id: string;
  total_pages: number;
  chunks_stored: number;
  files: FileSummary[];
}

interface DynamicUploadStepProps {
  sessionId: string;
  onProcessed: (result: ProcessResult) => void;
}

// ---------------------------------------------------------------------------
// File type helpers
// ---------------------------------------------------------------------------

type FileTypeKey = 'pdf' | 'pptx' | 'ppt' | 'docx' | 'doc' | 'xlsx' | 'csv';

const FILE_TYPE_CONFIG: Record<
  FileTypeKey,
  { label: string; Icon: React.ElementType; color: string }
> = {
  pdf:  { label: 'PDF',  Icon: FileText,  color: 'text-red-400' },
  pptx: { label: 'PPTX', Icon: Film,      color: 'text-orange-400' },
  ppt:  { label: 'PPT',  Icon: Film,      color: 'text-orange-400' },
  docx: { label: 'DOCX', Icon: BookOpen,  color: 'text-blue-400' },
  doc:  { label: 'DOC',  Icon: BookOpen,  color: 'text-blue-400' },
  xlsx: { label: 'XLSX', Icon: BarChart3, color: 'text-green-400' },
  csv:  { label: 'CSV',  Icon: AlignLeft, color: 'text-emerald-400' },
};

const DOC_ACCEPT = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'application/vnd.ms-powerpoint': ['.ppt'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'text/csv': ['.csv'],
  'application/csv': ['.csv'],
};

function getFileType(filename: string): FileTypeKey | null {
  const ext = filename.split('.').pop()?.toLowerCase() as FileTypeKey | undefined;
  return ext && ext in FILE_TYPE_CONFIG ? ext : null;
}

function FileTypeIcon({ filename, size = 16 }: { filename: string; size?: number }) {
  const key = getFileType(filename);
  if (!key) return <FileText size={size} className="text-[#525252] shrink-0" />;
  const { Icon, color } = FILE_TYPE_CONFIG[key];
  return <Icon size={size} className={`${color} shrink-0`} />;
}

// ---------------------------------------------------------------------------
// Reusable drop zone
// ---------------------------------------------------------------------------

function DropZone({
  label,
  hint,
  accept,
  onDropFiles,
  disabled,
}: {
  label: string;
  hint: string;
  accept: Record<string, string[]>;
  onDropFiles: (files: File[]) => void;
  disabled: boolean;
}) {
  const onDrop = useCallback((accepted: File[]) => onDropFiles(accepted), [onDropFiles]);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    multiple: false,
    disabled,
  });

  return (
    <div
      {...getRootProps()}
      className={[
        'rounded-[8px] border-2 border-dashed p-6 flex flex-col items-center gap-2 cursor-pointer transition-all',
        isDragActive
          ? 'border-amber-400 bg-amber-400/5'
          : 'border-[#262626] hover:border-[#404040]',
        disabled ? 'opacity-50 cursor-not-allowed' : '',
      ].join(' ')}
    >
      <input {...getInputProps()} />
      <div className={`p-2.5 rounded-[8px] ${isDragActive ? 'bg-amber-400/10' : 'bg-[#1a1a1a]'}`}>
        <Upload
          size={22}
          className={isDragActive ? 'text-amber-400' : 'text-[#525252]'}
        />
      </div>
      <p className="text-[13px] font-semibold text-center text-[#a3a3a3]">
        {isDragActive ? 'Drop here' : label}
      </p>
      <p className="text-[11px] text-center text-[#525252]">{hint}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function DynamicUploadStep({
  sessionId,
  onProcessed,
}: DynamicUploadStepProps) {
  const [docFile, setDocFile] = useState<File | null>(null);
  const [questionsFile, setQuestionsFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<QuestionValidation | null>(null);
  const [validating, setValidating] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const [phase, setPhase] = useState<'idle' | 'uploading' | 'processing'>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleDocDrop = (dropped: File[]) => {
    if (dropped.length > 0) setDocFile(dropped[0]);
  };

  const clearDoc = () => setDocFile(null);

  const handleQuestionsDrop = async (dropped: File[]) => {
    const file = dropped[0];
    if (!file) return;
    setQuestionsFile(file);
    setValidation(null);
    setValidating(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/agents/audit/upload-questions', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'X-Session-ID': sessionId,
        },
      });
      setValidation(res.data as QuestionValidation);
    } catch {
      setValidation({ valid: false, question_count: 0, preview: [], error: 'Validation request failed.' });
    }
    setValidating(false);
  };

  const clearQuestions = () => {
    setQuestionsFile(null);
    setValidation(null);
  };

  const canProcess = docFile !== null && validation?.valid === true && phase === 'idle';

  const handleProcess = async () => {
    if (!canProcess || !docFile) return;
    setError(null);
    setPhase('uploading');
    setProgress(15);

    try {
      const formData = new FormData();
      formData.append('files', docFile);

      await api.post('/agents/audit/upload-documents', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'X-Session-ID': sessionId,
        },
      });
      setProgress(40);

      setPhase('processing');
      setProgress(60);

      const res = await api.post('/agents/audit/process-dynamic', null, {
        headers: { 'X-Session-ID': sessionId },
      });
      setProgress(100);

      onProcessed(res.data as ProcessResult);
    } catch (err: unknown) {
      const data =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { detail?: string; error?: string } } }).response?.data
          : undefined;
      setError(data?.detail || data?.error || 'Processing failed. Please try again.');
      setPhase('idle');
      setProgress(0);
    }
  };

  const isLoading = phase !== 'idle';
  const phaseLabel =
    phase === 'uploading' ? 'Uploading document…' : 'Extracting & embedding content…';

  const docTypeLabel = docFile
    ? (getFileType(docFile.name)
        ? FILE_TYPE_CONFIG[getFileType(docFile.name)!].label
        : 'File') + ' document loaded'
    : '';

  return (
    <div className="space-y-6">
      {/* Sample data banner */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-[8px] border border-amber-400/20 bg-amber-400/5 text-[13px] text-[#a3a3a3]">
        <span>💡 Don't have files? Download our sample document and questions to try the agent instantly.</span>
        <div className="flex gap-2 shrink-0">
          <a
            href="/samples/sample_audit_document.docx"
            download="sample_audit_document.docx"
            className="px-3 py-1 rounded-[6px] font-medium border border-amber-400/30 text-amber-400 hover:bg-amber-400/10 transition-colors text-[12px]"
          >
            Download Sample Document
          </a>
          <a
            href="/samples/sample_audit_questions.csv"
            download="sample_audit_questions.csv"
            className="px-3 py-1 rounded-[6px] font-medium border border-amber-400/30 text-amber-400 hover:bg-amber-400/10 transition-colors text-[12px]"
          >
            Download Sample Questions
          </a>
        </div>
      </div>

      {/* Two sections side-by-side */}
      <div className="grid grid-cols-2 gap-4">

        {/* Left — Document */}
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#525252]">
            Upload Document
          </p>

          {!docFile ? (
            <DropZone
              label="Drag & drop document"
              hint="PDF, PPTX, DOCX, XLSX, CSV · single file"
              accept={DOC_ACCEPT}
              onDropFiles={handleDocDrop}
              disabled={isLoading}
            />
          ) : (
            <div className="rounded-[8px] border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-3">
              {/* File row */}
              <div className="flex items-center gap-2">
                <FileTypeIcon filename={docFile.name} size={14} />
                <p className="text-[12px] font-semibold flex-1 truncate text-[#a3a3a3]">
                  {docFile.name}
                </p>
                {!isLoading && (
                  <button
                    onClick={clearDoc}
                    className="p-1 rounded-[4px] transition-colors text-[#525252] hover:text-red-400 hover:bg-[#1a1a1a]"
                  >
                    <X size={11} />
                  </button>
                )}
              </div>

              {/* Status */}
              <div className="flex items-center gap-2">
                <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                <span className="text-[12px] font-semibold text-emerald-400">{docTypeLabel}</span>
              </div>
            </div>
          )}
        </div>

        {/* Right — Questions CSV */}
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#525252]">
            Audit Questions (CSV)
          </p>

          {!questionsFile ? (
            <DropZone
              label="Drag & drop questions CSV"
              hint="CSV with 'Questions' column · single file"
              accept={{ 'text/csv': ['.csv'], 'application/csv': ['.csv'] }}
              onDropFiles={handleQuestionsDrop}
              disabled={isLoading}
            />
          ) : (
            <div
              className={`rounded-[8px] border p-4 space-y-3 ${
                validation?.valid
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : validation && !validation.valid
                  ? 'bg-red-500/10 border-red-500/30'
                  : 'bg-[#0f0f0f] border-[#1e1e1e]'
              }`}
            >
              {/* File row */}
              <div className="flex items-center gap-2">
                <AlignLeft size={14} className="text-emerald-400 shrink-0" />
                <p className="text-[12px] font-semibold flex-1 truncate text-[#a3a3a3]">
                  {questionsFile.name}
                </p>
                {!isLoading && (
                  <button
                    onClick={clearQuestions}
                    className="p-1 rounded-[4px] transition-colors text-[#525252] hover:text-red-400 hover:bg-[#1a1a1a]"
                  >
                    <X size={11} />
                  </button>
                )}
              </div>

              {/* Validation state */}
              {validating && (
                <div className="flex items-center gap-2">
                  <Loader2 size={12} className="animate-spin text-amber-400" />
                  <span className="text-[12px] font-medium text-[#525252]">Validating…</span>
                </div>
              )}

              {validation?.valid && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                    <span className="text-[12px] font-semibold text-emerald-400">
                      {validation.question_count} questions loaded
                    </span>
                  </div>

                  {validation.preview.length > 0 && (
                    <div>
                      <button
                        onClick={() => setPreviewOpen((p) => !p)}
                        className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-widest transition-colors text-[#525252] hover:text-[#a3a3a3]"
                      >
                        Preview
                        {previewOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                      </button>
                      {previewOpen && (
                        <ul className="mt-2 space-y-1">
                          {validation.preview.map((q, i) => (
                            <li
                              key={i}
                              className="text-[12px] leading-relaxed px-2 py-1 rounded-[4px] bg-[#111111] text-[#a3a3a3]"
                            >
                              {i + 1}. {q}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )}

              {validation && !validation.valid && (
                <div className="flex items-start gap-2">
                  <AlertCircle size={13} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-[12px] text-red-400 font-medium leading-relaxed">
                    {validation.error}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {isLoading && (
        <ProgressBar
          value={progress}
          color="blue"
          label={phaseLabel}
          showPercentage
        />
      )}

      {/* Error */}
      {error && (
        <p className="text-[13px] text-red-400 font-medium px-1">{error}</p>
      )}

      {/* Process button */}
      {!isLoading && (
        <Button
          variant="primary"
          size="lg"
          onClick={handleProcess}
          disabled={!canProcess}
          className="w-full"
        >
          {!docFile
            ? 'Add a document to continue'
            : !validation?.valid
            ? 'Upload valid questions CSV to continue'
            : 'Process Document'}
        </Button>
      )}
    </div>
  );
}
