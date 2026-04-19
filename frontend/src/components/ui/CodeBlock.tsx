// Syntax-highlighted SQL display — no copy button (handled by QueryWorkspace toolbar).

import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface CodeBlockProps {
  code: string;
  language?: string;
}

export default function CodeBlock({ code, language = 'sql' }: CodeBlockProps) {
  return (
    <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-[8px] overflow-hidden">
      {/* Language label */}
      <div className="flex items-center px-4 py-2 bg-[#0f0f0f] border-b border-[#1e1e1e]">
        <span className="text-[10px] text-[#525252] font-mono font-semibold uppercase tracking-widest">
          {language}
        </span>
      </div>

      {/* Code */}
      <SyntaxHighlighter
        language={language}
        style={oneDark}
        customStyle={{
          background: '#0a0a0a',
          padding: '16px',
          margin: 0,
          borderRadius: 0,
          fontSize: '0.78rem',
          lineHeight: 1.6,
        }}
        codeTagProps={{ style: { background: '#0a0a0a' } }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}
