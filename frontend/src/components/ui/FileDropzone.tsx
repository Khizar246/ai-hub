// Drag-and-drop PDF upload using react-dropzone; shows file list with remove buttons.

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, X, AlertCircle } from 'lucide-react';
import { useUIStore } from '../../lib/store';

interface FileDropzoneProps {
  /** Currently selected files (controlled). */
  files: File[];
  /** Called when files change. */
  onChange: (files: File[]) => void;
  /** If true, only one file is accepted. Default false. */
  single?: boolean;
  /** Whether the dropzone is disabled. */
  disabled?: boolean;
}

export default function FileDropzone({
  files,
  onChange,
  single = false,
  disabled = false,
}: FileDropzoneProps) {
  const { darkMode } = useUIStore();

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
          'rounded-[2rem] border-2 border-dashed p-10 flex flex-col items-center gap-3 cursor-pointer transition-all',
          isDragActive
            ? darkMode
              ? 'border-blue-500 bg-blue-900/10'
              : 'border-blue-400 bg-blue-50'
            : hasRejections
            ? 'border-red-400 bg-red-50 dark:bg-red-900/10'
            : darkMode
            ? 'border-slate-700 hover:border-slate-500'
            : 'border-slate-200 hover:border-slate-300',
          disabled ? 'opacity-50 cursor-not-allowed' : '',
        ].join(' ')}
      >
        <input {...getInputProps()} />
        <div
          className={`p-3 rounded-xl ${
            isDragActive
              ? 'bg-blue-100 dark:bg-blue-900/30'
              : darkMode
              ? 'bg-slate-800'
              : 'bg-slate-100'
          }`}
        >
          <Upload
            size={28}
            className={
              isDragActive
                ? 'text-blue-500'
                : darkMode
                ? 'text-slate-400'
                : 'text-slate-500'
            }
          />
        </div>
        <div className="text-center">
          <p
            className={`text-sm font-black ${
              darkMode ? 'text-slate-300' : 'text-slate-700'
            }`}
          >
            {isDragActive ? 'Drop PDF here' : 'Drag & drop PDF, or click to browse'}
          </p>
          <p
            className={`text-xs mt-1 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}
          >
            PDF files only{single ? ' · one file' : ''}
          </p>
        </div>
      </div>

      {/* Rejected files error */}
      {hasRejections && (
        <div className="flex items-center gap-2 text-xs text-red-500 font-bold px-1">
          <AlertCircle size={13} />
          Only PDF files are accepted.
        </div>
      )}

      {/* File list */}
      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((file, idx) => (
            <li
              key={idx}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${
                darkMode
                  ? 'bg-slate-800 border-slate-700'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <FileText
                size={16}
                className={darkMode ? 'text-blue-400 shrink-0' : 'text-blue-600 shrink-0'}
              />
              <div className="flex-1 min-w-0">
                <p
                  className={`text-xs font-bold truncate ${
                    darkMode ? 'text-slate-200' : 'text-slate-700'
                  }`}
                >
                  {file.name}
                </p>
                <p
                  className={`text-[10px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}
                >
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <button
                onClick={() => removeFile(idx)}
                disabled={disabled}
                className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                  darkMode
                    ? 'text-slate-500 hover:text-red-400 hover:bg-slate-700'
                    : 'text-slate-400 hover:text-red-500 hover:bg-red-50'
                }`}
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
