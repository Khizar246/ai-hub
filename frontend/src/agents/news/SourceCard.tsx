// Displays a single source article: title, clickable URL, and the relevant excerpt.

import { ExternalLink, FileText } from 'lucide-react';

interface SourceCardProps {
  title: string;
  url: string;
  excerpt: string;
}

export default function SourceCard({ title, url, excerpt }: SourceCardProps) {
  const displayUrl = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  })();

  return (
    <div className="rounded-[8px] border border-[#1e1e1e] bg-[#0f0f0f] p-4 space-y-2 transition-all hover:border-amber-400/30">
      {/* Header row */}
      <div className="flex items-start gap-2">
        <FileText size={13} className="mt-0.5 shrink-0 text-[#525252]" />
        <div className="min-w-0">
          <p className="text-[13px] font-semibold truncate text-[#a3a3a3]">{title}</p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-medium flex items-center gap-1 hover:underline text-amber-400"
          >
            {displayUrl}
            <ExternalLink size={10} />
          </a>
        </div>
      </div>

      {/* Excerpt */}
      <p className="text-[12px] leading-relaxed line-clamp-3 border-l-2 pl-3 text-[#525252] border-[#262626]">
        {excerpt}
      </p>
    </div>
  );
}
