// Syntax-highlighted SQL display with copy-to-clipboard and language label.

import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import {
  oneDark,
  oneLight,
} from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check } from 'lucide-react';
import { useUIStore } from '../../lib/store';

interface CodeBlockProps {
  code: string;
  language?: string;
}

export default function CodeBlock({ code, language = 'sql' }: CodeBlockProps) {
  const { darkMode } = useUIStore();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard not available — silently ignore
    }
  };

  return (
    <div
      className={`rounded-2xl overflow-hidden border ${
        darkMode ? 'border-slate-700' : 'border-slate-200'
      }`}
    >
      {/* Header bar */}
      <div
        className={`flex items-center justify-between px-4 py-2 border-b ${
          darkMode
            ? 'bg-slate-800 border-slate-700'
            : 'bg-slate-50 border-slate-200'
        }`}
      >
        <span
          className={`text-[9px] font-black uppercase tracking-widest ${
            darkMode ? 'text-slate-500' : 'text-slate-400'
          }`}
        >
          {language}
        </span>
        <button
          onClick={handleCopy}
          className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest transition-colors ${
            copied
              ? 'text-emerald-500'
              : darkMode
              ? 'text-slate-500 hover:text-slate-300'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      {/* Code */}
      <SyntaxHighlighter
        language={language}
        style={darkMode ? oneDark : oneLight}
        customStyle={{
          margin: 0,
          borderRadius: 0,
          fontSize: '0.78rem',
          lineHeight: 1.6,
          padding: '1rem 1.25rem',
          background: darkMode ? '#0f172a' : '#ffffff',
        }}
        wrapLongLines
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}
