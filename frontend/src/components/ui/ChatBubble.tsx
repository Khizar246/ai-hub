// User and assistant chat message bubbles with timestamp and loading skeleton.

import { User, Bot } from 'lucide-react';

interface ChatBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
  loading?: boolean;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const cleanText = (text: string) =>
  text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/^#{1,3}\s/gm, '')
    .replace(/^-\s/gm, '• ');

export default function ChatBubble({
  role,
  content,
  timestamp,
  loading = false,
}: ChatBubbleProps) {
  const isUser = role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1 ${
          isUser ? 'bg-amber-400 text-[#0a0a0a]' : 'bg-[#1a1a1a] text-[#525252]'
        }`}
      >
        {isUser ? <User size={13} /> : <Bot size={13} />}
      </div>

      {/* Bubble */}
      <div className={`max-w-[75%] space-y-1 flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        {loading ? (
          <div className="px-5 py-4 rounded-[8px] rounded-tl-sm space-y-2 w-48 bg-[#111111] border border-[#1e1e1e]">
            <div className="h-2.5 w-full rounded-full animate-pulse bg-[#262626]" />
            <div className="h-2.5 w-3/4 rounded-full animate-pulse bg-[#262626]" />
            <div className="h-2.5 w-1/2 rounded-full animate-pulse bg-[#262626]" />
          </div>
        ) : (
          <div
            className={`px-4 py-3 text-[14px] leading-relaxed ${
              isUser
                ? 'bg-amber-400 text-[#0a0a0a] rounded-[8px] rounded-tr-sm max-w-[80%] ml-auto font-medium'
                : 'bg-[#111111] border border-[#1e1e1e] text-[#a3a3a3] rounded-[8px] rounded-tl-sm max-w-[80%]'
            }`}
          >
            <p className="whitespace-pre-wrap">{isUser ? content : cleanText(content)}</p>
          </div>
        )}

        {timestamp && !loading && (
          <p className="text-[11px] px-1 text-[#525252]">{formatTime(timestamp)}</p>
        )}
      </div>
    </div>
  );
}
