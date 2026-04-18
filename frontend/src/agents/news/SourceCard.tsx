// Displays a single source article: title, clickable URL, and the relevant excerpt

import { ExternalLink, FileText } from 'lucide-react';

interface SourceCardProps {
  title: string;
  url: string;
  excerpt: string;
  darkMode: boolean;
}

export default function SourceCard({ title, url, excerpt, darkMode }: SourceCardProps) {
  const displayUrl = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  })();

  return (
    <div
      className={`rounded-2xl border p-5 space-y-2 transition-all ${
        darkMode
          ? 'bg-slate-900/60 border-slate-700 hover:border-emerald-600'
          : 'bg-emerald-50 border-emerald-100 hover:border-emerald-400'
      }`}
    >
      {/* Header row */}
      <div className="flex items-start gap-2">
        <FileText
          size={14}
          className={`mt-0.5 shrink-0 ${darkMode ? 'text-emerald-400' : 'text-emerald-600'}`}
        />
        <div className="min-w-0">
          <p
            className={`text-xs font-black truncate ${
              darkMode ? 'text-white' : 'text-slate-800'
            }`}
          >
            {title}
          </p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={`text-[10px] font-bold flex items-center gap-1 hover:underline ${
              darkMode ? 'text-emerald-400' : 'text-emerald-600'
            }`}
          >
            {displayUrl}
            <ExternalLink size={10} />
          </a>
        </div>
      </div>

      {/* Excerpt */}
      <p
        className={`text-xs leading-relaxed line-clamp-3 border-l-2 pl-3 ${
          darkMode
            ? 'text-slate-400 border-emerald-700'
            : 'text-slate-600 border-emerald-300'
        }`}
      >
        {excerpt}
      </p>
    </div>
  );
}
