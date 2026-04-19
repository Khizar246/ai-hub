// Drag-and-drop PDF upload using react-dropzone; shows file list with remove buttons.

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, X, AlertCircle } from 'lucide-react';

interface FileDropzoneProps {
  files: File[];
  onChange: (files: File[]) => void;
  single?: boolean;
  disabled?: boolean;
}

export default function FileDropzone({
  files,
  onChange,
  single = false,
  disabled = false,
}: FileDropzoneProps) {
  const onDrop = useCallback(
    (accepted: File[]) => {
      onChange(single ? accepted.slice(0, 1) : [...files, ...accepted]);
    },
    [files, onChange, single]
  );

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: single ? 1 : undefined,
    disabled,
  });

  const removeFile = (idx: number) => {
    onChange(files.filter((_, i) => i !== idx));
  };

  const hasRejections = fileRejections.length > 0;

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={[
          'rounded-[8px] border-2 border-dashed p-10 flex flex-col items-center gap-3 cursor-pointer transition-all',
          isDragActive
            ? 'border-amber-400 bg-amber-400/5'
            : hasRejections
            ? 'border-red-500/40 bg-red-500/5'
            : 'border-[#262626] hover:border-[#404040]',
          disabled ? 'opacity-50 cursor-not-allowed' : '',
        ].join(' ')}
      >
        <input {...getInputProps()} />
        <div className={`p-3 rounded-[8px] ${isDragActive ? 'bg-amber-400/10' : 'bg-[#1a1a1a]'}`}>
          <Upload
            size={28}
            className={isDragActive ? 'text-amber-400' : 'text-[#525252]'}
          />
        </div>
        <div className="text-center">
          <p className="text-[14px] font-medium text-[#a3a3a3]">
            {isDragActive ? 'Drop PDF here' : 'Drag & drop PDF, or click to browse'}
          </p>
          <p className="text-[13px] mt-1 text-[#525252]">
            PDF files only{single ? ' · one file' : ''}
          </p>
        </div>
      </div>

      {hasRejections && (
        <div className="flex items-center gap-2 text-[13px] text-red-400 font-medium px-1">
          <AlertCircle size={13} />
          Only PDF files are accepted.
        </div>
      )}

      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((file, idx) => (
            <li
              key={idx}
              className="flex items-center gap-3 px-4 py-3 rounded-[6px] bg-[#0f0f0f] border border-[#1e1e1e]"
            >
              <FileText size={16} className="text-amber-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-[#a3a3a3] truncate">{file.name}</p>
                <p className="text-[11px] text-[#525252]">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <button
                onClick={() => removeFile(idx)}
                disabled={disabled}
                className="p-1.5 rounded-[4px] transition-colors text-[#525252] hover:text-red-400 hover:bg-[#1a1a1a] disabled:opacity-50"
              >
                <X size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
